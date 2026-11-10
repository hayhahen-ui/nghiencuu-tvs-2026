/**
 * Report Formatter & Academic Markdown Parser
 * Dùng chung cho giao diện chat, xuất Markdown, Word (.docx) và PDF (A4).
 * Chuẩn hóa nội dung AI (bóc JSON bọc ngoài, tách metadata chuyển đổi mô hình),
 * làm sạch tiêu đề đề tài, gộp các lượt hỏi lặp lỗi, và phân tích đầy đủ AST Markdown
 * (bao gồm bảng biểu, tiêu đề, danh sách nhiều cấp, code block, blockquote, trích dẫn).
 */

import type { ChatMessageItem, ChatSession } from "./chat-history-store";
import type { EvidenceReceipt } from "./research-documents";

export type InlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  citation?: boolean;
  url?: string;
};

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: { text: string; level: number }[] }
  | { type: "blockquote"; lines: string[] }
  | { type: "code"; language: string; code: string }
  | { type: "table"; headers: string[]; alignments: ("left" | "center" | "right")[]; rows: string[][] }
  | { type: "hr" };

export type DialogueExchange = {
  index: number;
  userContent: string;
  userTimestamp?: string;
  assistantContent?: string;
  assistantTimestamp?: string;
  evidence?: EvidenceReceipt;
  modelUsed?: string;
  requestedModel?: string;
  fallbackApplied?: boolean;
  skippedDuplicateRetries: number;
};

/**
 * Nếu mô hình AI trả về chuỗi JSON bọc `{"content": "..."}` (hoặc bọc trong ```json ... ```),
 * tự động giải mã để lấy phần văn bản thuần bên trong.
 */
export function unwrapJsonWrappedContent(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const candidates: string[] = [trimmed];
  const fencedMatch = trimmed.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
  if (fencedMatch) {
    candidates.unshift(fencedMatch[1].trim());
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith("{") || !candidate.endsWith("}")) continue;
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.content === "string" && parsed.content.trim()) {
          return parsed.content.trim();
        }
        if (typeof parsed.answer === "string" && parsed.answer.trim()) {
          return parsed.answer.trim();
        }
      }
    } catch {
      // Không phải JSON hợp lệ — giữ nguyên text
    }
  }

  return trimmed;
}

/**
 * Tách các thông báo hệ thống cũ từng bị nhúng thẳng vào văn bản (chuyển đổi model, ghi chú reasoning)
 * ra khỏi nội dung khoa học chính thức, đồng thời bóc bỏ JSON `{"content": ...}` nếu có.
 */
export function stripSystemPrefixes(raw: string): {
  text: string;
  switchedFromModel?: string;
  switchedToModel?: string;
  reasoningNote?: boolean;
} {
  let text = (raw || "").replace(/\r\n/g, "\n").trim();
  let switchedFromModel: string | undefined;
  let switchedToModel: string | undefined;
  let reasoningNote = false;

  // Tách banner chuyển đổi mô hình kiểu blockquote hoặc văn bản thuần kèm đường kẻ ---
  const switchBlockRegex =
    /^(?:>\s*)?💡\s*\*?\*?Thông báo chuyển đổi mô hình[\s\S]*?(?:\n---\s*\n+|\n{2,}(?=\{|[\p{L}0-9#*-]))/u;
  const switchMatch = text.match(switchBlockRegex);
  if (switchMatch) {
    const banner = switchMatch[0];
    const fromMatch = banner.match(/ban đầu\s*\(`?([^`)\n]+)`?\)/i) || banner.match(/requested model\s*`?([^`\n]+)`?/i);
    const toMatch = banner.match(/bằng mô hình[^:]*:\s*\*?\*?`?([^`*\n]+)`?\*?\*?/i) || banner.match(/Switched to\s*\*?\*?`?([^`*\n]+)`?\*?\*?/i);
    if (fromMatch) switchedFromModel = fromMatch[1].trim();
    if (toMatch) switchedToModel = toMatch[1].trim();
    text = text.slice(banner.length).trim();
  }

  // Tách banner tiếng Anh hoặc tiếng Trung nếu có
  const switchEnZhRegex =
    /^(?:>\s*)?💡\s*\*?\*?(?:Model Switch Notice|模型自动切换通知)[\s\S]*?(?:\n---\s*\n+|\n{2,})/i;
  if (switchEnZhRegex.test(text)) {
    text = text.replace(switchEnZhRegex, "").trim();
  }

  // Bỏ đường kẻ --- mồ côi ở đầu văn bản sau khi tách banner
  text = text.replace(/^---\s*\n+/, "").trim();

  // Bóc JSON {"content": "..."} sau khi đã bóc banner
  text = unwrapJsonWrappedContent(text);

  // Tách tiền tố ghi chú reasoning thô nếu xuất hiện ở đầu
  const reasoningPrefixRegex =
    /^(?:\*+Ghi chú:\s*Mô hình phản hồi qua kênh suy luận:\*+|\*\*⚠️\s*Ghi chú:\*\*[^\n]*(?:\n+---)?|\*+Note:\s*Model responded via reasoning channel:\*+)\s*\n+/i;
  if (reasoningPrefixRegex.test(text)) {
    reasoningNote = true;
    text = text.replace(reasoningPrefixRegex, "").trim();
    text = text.replace(/^---\s*\n+/, "").trim();
  }

  // Bóc JSON lần cuối đề phòng nested
  text = unwrapJsonWrappedContent(text);

  return { text, switchedFromModel, switchedToModel, reasoningNote };
}

/** Trả về văn bản khoa học sạch dùng cho UI, Markdown và xuất báo cáo. */
export function cleanAssistantText(raw: string): string {
  return stripSystemPrefixes(raw).text;
}

/**
 * Chuẩn hóa tiêu đề đề tài báo cáo từ câu hỏi hội thoại đầu tiên:
 * bỏ các cụm từ cầu khiến văn nói ("hãy phân tích tính khả khi của nhận định sau..."),
 * viết hoa chữ cái đầu và ngắt gọn theo ranh giới từ.
 */
export function normalizeReportTitle(rawTitle: string): string {
  let clean = (rawTitle || "").replace(/\s+/g, " ").trim();
  if (!clean) return "Phân tích kỹ thuật & Đánh giá an toàn khoa học";

  const fillerPatterns = [
    /^(?:xin\s+)?(?:hãy|vui lòng|nhờ anh|giúp tôi|cho tôi hỏi)\s+(?:phân tích(?:\s+tính\s+khả\s+[kt]h[iy])?(?:\s+của\s+nhận\s+định\s+sau)?|đánh giá|kiểm tra|giải thích|xem xét|tư vấn)\s*[:\-–]?\s*/i,
    /^(?:hãy|vui lòng)\s+/i,
  ];
  for (const pat of fillerPatterns) {
    const candidate = clean.replace(pat, "").trim();
    if (candidate.length >= 16) {
      clean = candidate;
      break;
    }
  }

  clean = clean.replace(/^[:\-–.,;]+\s*/, "");
  if (!clean) return "Phân tích kỹ thuật & Đánh giá an toàn khoa học";

  clean = clean.charAt(0).toLocaleUpperCase("vi-VN") + clean.slice(1);
  if (clean.length > 140) {
    const cut = clean.lastIndexOf(" ", 137);
    clean = clean.slice(0, cut > 60 ? cut : 137).trim() + "…";
  }
  return clean;
}

/**
 * Gộp chuỗi tin nhắn thành các chuyên đề / cặp trao đổi mạch lạc cho báo cáo.
 * Các lượt hỏi lặp lại giống hệt nhau khi hệ thống gặp lỗi ở giữa được gộp gọn để đánh số Chuyên đề [1], [2]... chính xác.
 */
export function groupDialogueExchanges(messages: ChatMessageItem[]): DialogueExchange[] {
  const exchanges: DialogueExchange[] = [];
  let pendingUser: { content: string; timestamp?: string; skipped: number } | null = null;

  const flushPendingAsUnanswered = () => {
    if (!pendingUser) return;
    exchanges.push({
      index: exchanges.length + 1,
      userContent: pendingUser.content,
      userTimestamp: pendingUser.timestamp,
      skippedDuplicateRetries: pendingUser.skipped,
    });
    pendingUser = null;
  };

  for (const msg of messages) {
    if (msg.role === "user") {
      const normalized = msg.content.trim();
      if (!normalized) continue;
      if (pendingUser) {
        const samePrompt =
          pendingUser.content.replace(/\s+/g, " ") === normalized.replace(/\s+/g, " ");
        if (samePrompt) {
          // Lượt gửi lại giống hệt câu hỏi đang chờ: giữ mốc mới nhất
          pendingUser.timestamp = msg.timestamp || pendingUser.timestamp;
          pendingUser.skipped += 1;
          continue;
        }
        // Nếu là câu hỏi rác cực ngắn (ví dụ nhắc ngôn ngữ) ngay trước câu hỏi chi tiết và chưa có trả lời, giữ làm ngữ cảnh phụ hoặc đẩy lên
        flushPendingAsUnanswered();
      }
      pendingUser = { content: normalized, timestamp: msg.timestamp, skipped: 0 };
    } else {
      const cleaned = stripSystemPrefixes(msg.content);
      const modelUsed = msg.model || cleaned.switchedToModel;
      const requestedModel = msg.requestedModel || cleaned.switchedFromModel;
      if (pendingUser) {
        exchanges.push({
          index: exchanges.length + 1,
          userContent: pendingUser.content,
          userTimestamp: pendingUser.timestamp,
          assistantContent: cleaned.text,
          assistantTimestamp: msg.timestamp,
          evidence: msg.evidence,
          modelUsed,
          requestedModel,
          fallbackApplied: msg.fallbackApplied ?? Boolean(cleaned.switchedToModel),
          skippedDuplicateRetries: pendingUser.skipped,
        });
        pendingUser = null;
      } else {
        exchanges.push({
          index: exchanges.length + 1,
          userContent: "(Tiếp nối phân tích từ lượt trước)",
          assistantContent: cleaned.text,
          assistantTimestamp: msg.timestamp,
          evidence: msg.evidence,
          modelUsed,
          requestedModel,
          fallbackApplied: msg.fallbackApplied ?? Boolean(cleaned.switchedToModel),
          skippedDuplicateRetries: 0,
        });
      }
    }
  }

  flushPendingAsUnanswered();
  return exchanges;
}

/**
 * Trích xuất phần Tóm tắt điều hành / Kết luận chính từ phản hồi phân tích gần nhất có nội dung.
 */
export function extractExecutiveSummary(exchanges: DialogueExchange[]): string {
  const answered = [...exchanges]
    .reverse()
    .find((ex) => ex.assistantContent && ex.assistantContent.trim().length > 40);
  if (!answered?.assistantContent) {
    return "Phiên làm việc hiện chưa ghi nhận kết luận phân tích hoàn chỉnh từ trợ lý AI.";
  }

  const text = answered.assistantContent.trim();

  // 1. Ưu tiên tìm mục "Tóm tắt & Kết luận Thẩm định" hoặc "Kết luận" / "Executive Summary"
  const headingMatch = text.match(
    /(?:^|\n)#{1,4}\s*(?:\d+\.\s*)?(?:Tóm tắt(?:\s*&\s*Kết luận[^\n]*)?|Kết luận(?:\s+thẩm định|\s+chung)?|Executive Summary|Conclusion|结论)[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s|$)/i,
  );
  if (headingMatch && headingMatch[1].trim().length >= 40) {
    return headingMatch[1].trim();
  }

  // 2. Tìm dòng "Kết luận:" / "Khuyến nghị chính:" ở cuối bài
  const inlineConclusion = text.match(
    /(?:^|\n)\*{0,2}(?:Kết luận|KẾT LUẬN|Conclusion|Summary)\*{0,2}\s*:\s*([\s\S]{40,1200})$/i,
  );
  if (inlineConclusion) {
    return inlineConclusion[1].trim();
  }

  // 3. Fallback: lấy đoạn đầu và đoạn cuối có nghĩa
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length <= 2) return blocks.join("\n\n");
  return `${blocks[0]}\n\n${blocks[blocks.length - 1]}`;
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false;
  const cells = splitTableRow(trimmed);
  return cells.length >= 2 && cells.every((cell) => /^:?-{2,}:?$/.test(cell.trim()));
}

function splitTableRow(line: string): string[] {
  let cleaned = line.trim();
  if (cleaned.startsWith("|")) cleaned = cleaned.slice(1);
  if (cleaned.endsWith("|")) cleaned = cleaned.slice(0, -1);
  return cleaned.split("|").map((c) => c.trim());
}

function parseTableAlignments(line: string, columnCount: number): ("left" | "center" | "right")[] {
  const raw = splitTableRow(line);
  return Array.from({ length: columnCount }, (_, i) => {
    const cell = (raw[i] || "").trim();
    if (cell.startsWith(":") && cell.endsWith(":")) return "center";
    if (cell.endsWith(":")) return "right";
    return "left";
  });
}

/**
 * Phân tích văn bản Markdown thành danh sách các khối chuẩn (heading, table, list, blockquote, code, paragraph, hr).
 */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Code block ```lang
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: "code", language, code: codeLines.join("\n") });
      continue;
    }

    // 2. Horizontal rule
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 3. Heading # .. ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      blocks.push({ type: "heading", level, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // 4. Markdown Table (header line + separator line)
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
      const headers = splitTableRow(trimmed);
      const alignments = parseTableAlignments(lines[i + 1], headers.length);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length) {
        const rowTrimmed = lines[i].trim();
        if (!rowTrimmed || !rowTrimmed.includes("|")) break;
        const cells = splitTableRow(rowTrimmed);
        rows.push(Array.from({ length: headers.length }, (_, col) => cells[col] ?? ""));
        i++;
      }
      blocks.push({ type: "table", headers, alignments, rows });
      continue;
    }

    // 5. Blockquote >
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    // 6. Lists (ordered or unordered)
    const isUnordered = (l: string) => /^\s*[-*•]\s+/.test(l);
    const isOrdered = (l: string) => /^\s*\d+[.)]\s+/.test(l);
    if (isUnordered(rawLine) || isOrdered(rawLine)) {
      const ordered = isOrdered(rawLine);
      const items: { text: string; level: number }[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const match = ordered
          ? cur.match(/^(\s*)\d+[.)]\s+(.+)$/)
          : cur.match(/^(\s*)[-*•]\s+(.+)$/);
        if (!match) break;
        const level = Math.min(2, Math.floor(match[1].length / 2));
        items.push({ text: match[2].trim(), level });
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // 7. Normal paragraph (gom các dòng văn bản liên tục cho tới khối khác hoặc dòng trống)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      const curTrim = cur.trim();
      if (
        !curTrim ||
        curTrim.startsWith("```") ||
        /^(?:-{3,}|\*{3,}|_{3,})$/.test(curTrim) ||
        /^#{1,4}\s+/.test(curTrim) ||
        curTrim.startsWith(">") ||
        isUnordered(cur) ||
        isOrdered(cur) ||
        (curTrim.includes("|") && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(curTrim);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join(" ") });
    }
  }

  return blocks;
}

/**
 * Tách định dạng nội tuyến (in đậm, nghiêng, inline code, liên kết nguồn `#source/...` và URL ngoài).
 */
export function parseInlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  // Khớp lần lượt: link [label](url), bold **...**, italic *...*, code `...`
  const tokenRegex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(tokenRegex)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      runs.push({ text: text.slice(lastIndex, idx) });
    }
    const token = match[0];

    if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        if (href.startsWith("#source/")) {
          runs.push({ text: `[${label}]`, citation: true, bold: true });
        } else {
          runs.push({ text: label, url: href });
        }
      } else {
        runs.push({ text: token });
      }
    } else if (token.startsWith("**") && token.endsWith("**")) {
      runs.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      runs.push({ text: token.slice(1, -1), italic: true });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push({ text: token.slice(1, -1), code: true });
    }

    lastIndex = idx + token.length;
  }

  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex) });
  }

  return runs.length > 0 ? runs : [{ text }];
}

/**
 * Định dạng tên hiển thị gọn của tài liệu căn cứ từ session & messages.
 */
export function collectEvidenceDocumentList(session: ChatSession, exchanges: DialogueExchange[]): string[] {
  const names = new Set<string>(session.documentNames || []);
  for (const ex of exchanges) {
    for (const src of ex.evidence?.sources || []) {
      if (src.name) names.add(src.name);
    }
  }
  return [...names];
}
