/**
 * Scientific Research Export Module
 * Chuẩn xuất báo cáo nghiên cứu khoa học cho Hội thoại (Word .docx & PDF A4)
 * Thiết kế theo quy chuẩn hồ sơ kỹ thuật R&D:
 * - Quốc hiệu, tiêu ngữ, mã hồ sơ và bảng thông số phiên làm việc
 * - Danh mục tài liệu căn cứ (Evidence Registry) đánh mã [TL-01], [TL-02]...
 * - Mục Tóm tắt điều hành & Kết luận chính (Executive Summary) ngay đầu báo cáo
 * - Render đầy đủ cấu trúc Markdown khoa học (bảng biểu, danh sách nhiều cấp, callout, trích dẫn nguồn)
 * - Khối khuyến nghị kiểm chứng thực nghiệm / EHS và bảng ký duyệt 3 cấp
 */

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  HeadingLevel,
  Packer,
  Header,
  Footer,
  PageNumber,
  ShadingType,
} from "docx";
import type { ChatSession } from "./chat-history-store";
import {
  collectEvidenceDocumentList,
  extractExecutiveSummary,
  groupDialogueExchanges,
  normalizeReportTitle,
  parseInlineRuns,
  parseMarkdownBlocks,
  type DialogueExchange,
  type InlineRun,
  type MarkdownBlock,
} from "./report-formatter";

const FONT_FAMILY = "Times New Roman";
const MONO_FONT = "Consolas";
const PRIMARY_COLOR = "1E3A8A"; // Navy đậm học thuật
const ACCENT_TEAL = "0F766E"; // Xanh ngọc trích dẫn
const ACCENT_SKY = "0369A1"; // Xanh dương yêu cầu nghiên cứu
const TEXT_COLOR = "1E293B"; // Slate đậm dễ đọc
const MUTED_COLOR = "64748B"; // Slate nhạt
const BORDER_COLOR = "CBD5E1"; // Viền mảnh
const SUBTLE_BG = "F8FAFC"; // Nền ô nhạt
const CALLOUT_BG = "F1F5F9"; // Nền callout tóm tắt

const CELL_MARGINS = { top: 90, bottom: 90, left: 120, right: 120 };
const NO_CELL_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function formatLangLabel(lang: ChatSession["language"]): string {
  if (lang === "vi") return "Tiếng Việt (Chuẩn học thuật)";
  if (lang === "zh") return "中文 (简体中文)";
  return "English (Scientific Standard)";
}

function escapeHtml(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toDocxTextRuns(runs: InlineRun[], baseSize = 21, baseColor = TEXT_COLOR, forceItalic = false): TextRun[] {
  return runs.map((run) => {
    if (run.code) {
      return new TextRun({
        text: run.text,
        font: MONO_FONT,
        size: Math.max(17, baseSize - 2),
        color: "991B1B",
        bold: run.bold,
      });
    }
    if (run.citation) {
      return new TextRun({
        text: run.text,
        font: FONT_FAMILY,
        size: baseSize - 1,
        bold: true,
        color: ACCENT_TEAL,
      });
    }
    if (run.url) {
      return new TextRun({
        text: `${run.text} (${run.url})`,
        font: FONT_FAMILY,
        size: baseSize,
        color: ACCENT_SKY,
        underline: {},
      });
    }
    return new TextRun({
      text: run.text,
      font: FONT_FAMILY,
      size: baseSize,
      bold: run.bold,
      italics: forceItalic || run.italic,
      color: baseColor,
    });
  });
}

function renderInlineRunsHtml(runs: InlineRun[]): string {
  return runs
    .map((run) => {
      const safe = escapeHtml(run.text);
      if (run.code) return `<code class="inline-code">${safe}</code>`;
      if (run.citation) return `<span class="citation-tag">${safe}</span>`;
      if (run.url) {
        return `<a class="doc-link" href="${escapeHtml(run.url)}">${safe}</a>`;
      }
      let out = safe;
      if (run.bold) out = `<strong>${out}</strong>`;
      if (run.italic) out = `<em>${out}</em>`;
      return out;
    })
    .join("");
}

function docxAlignment(align: "left" | "center" | "right") {
  if (align === "center") return AlignmentType.CENTER;
  if (align === "right") return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

/**
 * Chuyển đổi danh sách MarkdownBlock thành các phần tử Word (.docx) hoàn chỉnh.
 */
function renderBlocksToDocx(blocks: MarkdownBlock[]): (Paragraph | Table)[] {
  const nodes: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const sizeMap = { 1: 25, 2: 23, 3: 21, 4: 20 } as const;
        const beforeMap = { 1: 220, 2: 180, 3: 140, 4: 110 } as const;
        nodes.push(
          new Paragraph({
            keepNext: true,
            spacing: { before: beforeMap[block.level], after: 70 },
            border:
              block.level <= 2
                ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0", space: 4 } }
                : undefined,
            children: [
              new TextRun({
                text: block.text.replace(/\*\*/g, ""),
                bold: true,
                size: sizeMap[block.level],
                font: FONT_FAMILY,
                color: block.level <= 2 ? PRIMARY_COLOR : "0F172A",
              }),
            ],
          }),
        );
        break;
      }

      case "paragraph": {
        nodes.push(
          new Paragraph({
            spacing: { after: 90, line: 280 },
            alignment: AlignmentType.BOTH,
            children: toDocxTextRuns(parseInlineRuns(block.text), 21, TEXT_COLOR),
          }),
        );
        break;
      }

      case "list": {
        block.items.forEach((item, idx) => {
          const runs = parseInlineRuns(item.text);
          if (block.ordered) {
            nodes.push(
              new Paragraph({
                spacing: { after: 65, line: 276 },
                indent: { left: 360 + item.level * 280, hanging: 240 },
                children: [
                  new TextRun({
                    text: `${idx + 1}. `,
                    bold: true,
                    font: FONT_FAMILY,
                    size: 21,
                    color: PRIMARY_COLOR,
                  }),
                  ...toDocxTextRuns(runs, 21, TEXT_COLOR),
                ],
              }),
            );
          } else {
            nodes.push(
              new Paragraph({
                bullet: { level: item.level },
                spacing: { after: 65, line: 276 },
                children: toDocxTextRuns(runs, 21, TEXT_COLOR),
              }),
            );
          }
        });
        break;
      }

      case "blockquote": {
        const quoteParagraphs = block.lines
          .filter((l) => l.trim().length > 0)
          .map(
            (l) =>
              new Paragraph({
                spacing: { after: 50, line: 264 },
                children: toDocxTextRuns(parseInlineRuns(l), 20, "334155", true),
              }),
          );
        if (quoteParagraphs.length > 0) {
          nodes.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT_SKY },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
              },
              rows: [
                new TableRow({
                  cantSplit: true,
                  children: [
                    new TableCell({
                      shading: { fill: SUBTLE_BG, type: ShadingType.CLEAR },
                      margins: { top: 80, bottom: 80, left: 160, right: 120 },
                      borders: NO_CELL_BORDERS,
                      children: quoteParagraphs,
                    }),
                  ],
                }),
              ],
            }),
            new Paragraph({ spacing: { after: 70 }, children: [] }),
          );
        }
        break;
      }

      case "code": {
        const codeLines = (block.code || "").split("\n");
        nodes.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
              left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
              right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    shading: { fill: "F1F5F9", type: ShadingType.CLEAR },
                    margins: { top: 100, bottom: 100, left: 140, right: 140 },
                    children: codeLines.map(
                      (cl) =>
                        new Paragraph({
                          spacing: { after: 20, line: 240 },
                          children: [
                            new TextRun({
                              text: cl || " ",
                              font: MONO_FONT,
                              size: 17,
                              color: "0F172A",
                            }),
                          ],
                        }),
                    ),
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 80 }, children: [] }),
        );
        break;
      }

      case "table": {
        const colCount = block.headers.length || 1;
        const colWidth = Math.floor(100 / colCount);
        const headerRow = new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: block.headers.map(
            (h, cIdx) =>
              new TableCell({
                width: { size: colWidth, type: WidthType.PERCENTAGE },
                shading: { fill: PRIMARY_COLOR, type: ShadingType.CLEAR },
                margins: CELL_MARGINS,
                children: [
                  new Paragraph({
                    alignment: docxAlignment(block.alignments[cIdx] || "left"),
                    children: toDocxTextRuns(parseInlineRuns(h), 19, "FFFFFF").map((tr) => {
                      // Bảo đảm chữ header luôn trắng & đậm
                      return new TextRun({
                        text: h.replace(/\*\*/g, "").replace(/`/g, ""),
                        bold: true,
                        font: FONT_FAMILY,
                        size: 19,
                        color: "FFFFFF",
                      });
                    }),
                  }),
                ],
              }),
          ),
        });

        const dataRows = block.rows.map(
          (row, rIdx) =>
            new TableRow({
              cantSplit: true,
              children: Array.from({ length: colCount }, (_, cIdx) => {
                const cellText = row[cIdx] || "—";
                return new TableCell({
                  width: { size: colWidth, type: WidthType.PERCENTAGE },
                  shading: rIdx % 2 === 1 ? { fill: SUBTLE_BG, type: ShadingType.CLEAR } : undefined,
                  margins: CELL_MARGINS,
                  children: [
                    new Paragraph({
                      alignment: docxAlignment(block.alignments[cIdx] || "left"),
                      spacing: { after: 20, line: 250 },
                      children: toDocxTextRuns(parseInlineRuns(cellText), 19, TEXT_COLOR),
                    }),
                  ],
                });
              }),
            }),
        );

        nodes.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY_COLOR },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY_COLOR },
              left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
              right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
              insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
            },
            rows: [headerRow, ...dataRows],
          }),
          new Paragraph({ spacing: { after: 100 }, children: [] }),
        );
        break;
      }

      case "hr": {
        nodes.push(
          new Paragraph({
            spacing: { before: 80, after: 100 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR } },
            children: [],
          }),
        );
        break;
      }
    }
  }

  return nodes;
}

function renderBlocksToHtml(blocks: MarkdownBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading": {
          const tag = `h${Math.min(4, block.level)}` as "h1" | "h2" | "h3" | "h4";
          return `<${tag} class="md-h${block.level}">${renderInlineRunsHtml(parseInlineRuns(block.text))}</${tag}>`;
        }
        case "paragraph":
          return `<p class="md-p">${renderInlineRunsHtml(parseInlineRuns(block.text))}</p>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items
            .map(
              (item) =>
                `<li class="level-${item.level}">${renderInlineRunsHtml(parseInlineRuns(item.text))}</li>`,
            )
            .join("");
          return `<${tag} class="md-list">${items}</${tag}>`;
        }
        case "blockquote":
          return `<blockquote class="md-quote">${block.lines
            .map((l) => `<p>${renderInlineRunsHtml(parseInlineRuns(l))}</p>`)
            .join("")}</blockquote>`;
        case "code":
          return `<pre class="md-code"><code>${escapeHtml(block.code)}</code></pre>`;
        case "table": {
          const ths = block.headers
            .map(
              (h, idx) =>
                `<th style="text-align:${block.alignments[idx] || "left"}">${renderInlineRunsHtml(
                  parseInlineRuns(h),
                )}</th>`,
            )
            .join("");
          const trs = block.rows
            .map(
              (row) =>
                `<tr>${block.headers
                  .map(
                    (_, idx) =>
                      `<td style="text-align:${block.alignments[idx] || "left"}">${renderInlineRunsHtml(
                        parseInlineRuns(row[idx] || "—"),
                      )}</td>`,
                  )
                  .join("")}</tr>`,
            )
            .join("");
          return `<div class="table-wrap"><table class="md-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
        }
        case "hr":
          return `<hr class="md-hr" />`;
      }
    })
    .join("\n");
}

function createSectionBanner(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 260, after: 110 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PRIMARY_COLOR, space: 4 } },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 23,
        font: FONT_FAMILY,
        color: PRIMARY_COLOR,
      }),
    ],
  });
}

function createMetaRow(label: string, value: string): TableRow {
  return new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { fill: SUBTLE_BG, type: ShadingType.CLEAR },
        margins: CELL_MARGINS,
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: label,
                bold: true,
                size: 19,
                font: FONT_FAMILY,
                color: "334155",
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        margins: CELL_MARGINS,
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: value,
                size: 19,
                font: FONT_FAMILY,
                color: "0F172A",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function buildEvidenceRegistryTable(docs: string[], exchanges: DialogueExchange[]): Table | null {
  if (docs.length === 0) return null;

  const coverageMap = new Map<string, string>();
  for (const ex of exchanges) {
    for (const src of ex.evidence?.sources || []) {
      if (src.name && src.units?.length) {
        coverageMap.set(src.name, `Đã trích ${src.units.length} đoạn căn cứ`);
      }
    }
  }

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        shading: { fill: PRIMARY_COLOR, type: ShadingType.CLEAR },
        margins: CELL_MARGINS,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "STT", bold: true, size: 18, font: FONT_FAMILY, color: "FFFFFF" })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 16, type: WidthType.PERCENTAGE },
        shading: { fill: PRIMARY_COLOR, type: ShadingType.CLEAR },
        margins: CELL_MARGINS,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Mã TL", bold: true, size: 18, font: FONT_FAMILY, color: "FFFFFF" })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        shading: { fill: PRIMARY_COLOR, type: ShadingType.CLEAR },
        margins: CELL_MARGINS,
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Tên tệp tài liệu khoa học / SDS / MSDS", bold: true, size: 18, font: FONT_FAMILY, color: "FFFFFF" })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 26, type: WidthType.PERCENTAGE },
        shading: { fill: PRIMARY_COLOR, type: ShadingType.CLEAR },
        margins: CELL_MARGINS,
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Trạng thái đối chiếu", bold: true, size: 18, font: FONT_FAMILY, color: "FFFFFF" })],
          }),
        ],
      }),
    ],
  });

  const rows = docs.map((name, idx) => {
    const code = `TL-${String(idx + 1).padStart(2, "0")}`;
    const note = coverageMap.get(name) || "Đưa vào ngữ cảnh đối chiếu";
    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: idx % 2 === 1 ? { fill: SUBTLE_BG, type: ShadingType.CLEAR } : undefined,
          margins: CELL_MARGINS,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(idx + 1), size: 18, font: FONT_FAMILY })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 16, type: WidthType.PERCENTAGE },
          shading: idx % 2 === 1 ? { fill: SUBTLE_BG, type: ShadingType.CLEAR } : undefined,
          margins: CELL_MARGINS,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: code, bold: true, size: 18, font: MONO_FONT, color: PRIMARY_COLOR })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          shading: idx % 2 === 1 ? { fill: SUBTLE_BG, type: ShadingType.CLEAR } : undefined,
          margins: CELL_MARGINS,
          children: [
            new Paragraph({
              children: [new TextRun({ text: name, size: 18, font: FONT_FAMILY, color: "0F172A" })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 26, type: WidthType.PERCENTAGE },
          shading: idx % 2 === 1 ? { fill: SUBTLE_BG, type: ShadingType.CLEAR } : undefined,
          margins: CELL_MARGINS,
          children: [
            new Paragraph({
              children: [new TextRun({ text: note, size: 18, font: FONT_FAMILY, color: ACCENT_TEAL })],
            }),
          ],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY_COLOR },
      left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
    },
    rows: [headerRow, ...rows],
  });
}

function formatDocCode(session: ChatSession): string {
  const shortId = (session.id || "RND").replace(/^session-/, "").slice(-6).toUpperCase();
  const dt = new Date(session.updatedAt || session.createdAt || Date.now());
  const ymd = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
  return `NC-${ymd}-${shortId}`;
}

/**
 * Xây dựng đối tượng Document Word (.docx) chuẩn Báo cáo Thẩm định & Nghiên cứu Khoa học R&D.
 */
export function buildScientificWordDoc(session: ChatSession): Document {
  const exchanges = groupDialogueExchanges(session.messages);
  const meaningfulExchanges = exchanges.filter(
    (ex) => Boolean(ex.assistantContent) || ex.userContent.length >= 40,
  );
  const displayExchanges = meaningfulExchanges.length > 0 ? meaningfulExchanges : exchanges;
  const cleanTitle = normalizeReportTitle(session.title);
  const docs = collectEvidenceDocumentList(session, exchanges);
  const summaryMarkdown = extractExecutiveSummary(displayExchanges);
  const docCode = formatDocCode(session);

  const exportDate = new Date(session.updatedAt || session.createdAt);
  const dateStr = exportDate.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = exportDate.toLocaleTimeString("vi-VN");
  const answeredCount = displayExchanges.filter((ex) => Boolean(ex.assistantContent)).length;

  // Khối Header Quốc hiệu & Đơn vị nghiên cứu
  const topHeaderTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 10, color: PRIMARY_COLOR },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 52, type: WidthType.PERCENTAGE },
            margins: { top: 40, bottom: 100, left: 40, right: 80 },
            borders: NO_CELL_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "HỆ THỐNG TRỢ LÝ NGHIÊN CỨU KHOA HỌC",
                    bold: true,
                    size: 19,
                    font: FONT_FAMILY,
                    color: PRIMARY_COLOR,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 20 },
                children: [
                  new TextRun({
                    text: `PHÒNG R&D · MÃ HỒ SƠ: ${docCode}`,
                    size: 17,
                    font: FONT_FAMILY,
                    color: MUTED_COLOR,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            margins: { top: 40, bottom: 100, left: 80, right: 40 },
            borders: NO_CELL_BORDERS,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
                    bold: true,
                    size: 19,
                    font: FONT_FAMILY,
                    color: "0F172A",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 20 },
                children: [
                  new TextRun({
                    text: "Độc lập - Tự do - Hạnh phúc",
                    bold: true,
                    italics: true,
                    size: 18,
                    font: FONT_FAMILY,
                    color: "334155",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const bodyNodes: (Paragraph | Table)[] = [
    topHeaderTable,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 40 },
      children: [
        new TextRun({
          text: "HỒ SƠ PHÂN TÍCH KỸ THUẬT & THẨM ĐỊNH AN TOÀN R&D",
          bold: true,
          size: 17,
          font: FONT_FAMILY,
          color: ACCENT_TEAL,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 100 },
      children: [
        new TextRun({
          text: "BÁO CÁO KẾT QUẢ ĐỐI THOẠI & PHÂN TÍCH KHOA HỌC",
          bold: true,
          size: 29,
          font: FONT_FAMILY,
          color: PRIMARY_COLOR,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: `Đề tài: ${cleanTitle}`,
          bold: true,
          italics: true,
          size: 22,
          font: FONT_FAMILY,
          color: "334155",
        }),
      ],
    }),
  ];

  // Mục I: Hồ sơ nghiên cứu & Danh mục tài liệu căn cứ
  bodyNodes.push(createSectionBanner("I. HỒ SƠ NGHIÊN CỨU & DANH MỤC TÀI LIỆU CĂN CỨ"));

  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY_COLOR },
      left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
    },
    rows: [
      createMetaRow("Mã hồ sơ / Phiên lưu trữ:", `${docCode} (${session.id})`),
      createMetaRow("Thời gian khởi tạo:", new Date(session.createdAt).toLocaleString("vi-VN")),
      createMetaRow("Thời điểm hoàn tất báo cáo:", `${dateStr}, ${timeStr}`),
      createMetaRow("Mô hình AI chủ đạo:", session.model || "deepseek-v4.1-flash"),
      createMetaRow("Ngôn ngữ báo cáo:", formatLangLabel(session.language)),
      createMetaRow(
        "Quy mô nội dung:",
        `${answeredCount}/${displayExchanges.length} chuyên đề có phản hồi khoa học hoàn chỉnh (${docs.length} tài liệu căn cứ)`,
      ),
    ],
  });
  bodyNodes.push(metadataTable, new Paragraph({ spacing: { after: 120 }, children: [] }));

  const evidenceTable = buildEvidenceRegistryTable(docs, exchanges);
  if (evidenceTable) {
    bodyNodes.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: "Bảng 1. Danh mục tài liệu khoa học / SDS / MSDS làm căn cứ đối chiếu",
            bold: true,
            italics: true,
            size: 19,
            font: FONT_FAMILY,
            color: "334155",
          }),
        ],
      }),
      evidenceTable,
      new Paragraph({ spacing: { after: 100 }, children: [] }),
    );
  }

  // Nguyên tắc toàn vẹn dữ liệu trong Callout gọn
  bodyNodes.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        left: { style: BorderStyle.SINGLE, size: 16, color: ACCENT_TEAL },
        right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              shading: { fill: SUBTLE_BG, type: ShadingType.CLEAR },
              margins: CELL_MARGINS,
              children: [
                new Paragraph({
                  spacing: { after: 40, line: 260 },
                  children: [
                    new TextRun({
                      text: "Nguyên tắc toàn vẹn dữ liệu & Giới hạn kiểm chứng: ",
                      bold: true,
                      size: 19,
                      font: FONT_FAMILY,
                      color: ACCENT_TEAL,
                    }),
                    new TextRun({
                      text: "Mọi thông số (số CAS, thành phần %, điểm chớp cháy, mã nguy hại GHS H/P, giới hạn phơi nhiễm TWA/STEL, PPE) được trích xuất trực tiếp từ các tệp SDS/MSDS cung cấp ở Bảng 1. Các phân tích không tự ý điền số liệu khuyết thiếu và tách biệt rõ giữa dữ kiện trích từ nguồn với nhận định chuyên môn.",
                      size: 19,
                      font: FONT_FAMILY,
                      color: TEXT_COLOR,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  // Mục II: Tóm tắt điều hành & Kết luận chính
  bodyNodes.push(createSectionBanner("II. TÓM TẮT ĐIỀU HÀNH & KẾT LUẬN CHÍNH"));
  const summaryBlocks = parseMarkdownBlocks(summaryMarkdown);
  const summaryDocxNodes = renderBlocksToDocx(summaryBlocks);
  const summaryParagraphOnly = summaryDocxNodes.filter((n): n is Paragraph => n instanceof Paragraph);
  if (summaryParagraphOnly.length > 0 && summaryParagraphOnly.length === summaryDocxNodes.length) {
    bodyNodes.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "BFDBFE" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFDBFE" },
          left: { style: BorderStyle.SINGLE, size: 20, color: PRIMARY_COLOR },
          right: { style: BorderStyle.SINGLE, size: 4, color: "BFDBFE" },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: CALLOUT_BG, type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 160, right: 140 },
                children: summaryParagraphOnly,
              }),
            ],
          }),
        ],
      }),
    );
  } else {
    bodyNodes.push(...summaryDocxNodes);
  }

  // Mục III: Nội dung phân tích khoa học chi tiết
  bodyNodes.push(createSectionBanner("III. NỘI DUNG PHÂN TÍCH KHOA HỌC & KỸ THUẬT CHI TIẾT"));

  displayExchanges.forEach((ex, idx) => {
    const num = idx + 1;
    const uTime = ex.userTimestamp ? new Date(ex.userTimestamp).toLocaleTimeString("vi-VN") : "";
    const aTime = ex.assistantTimestamp ? new Date(ex.assistantTimestamp).toLocaleTimeString("vi-VN") : "";

    bodyNodes.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: `Chuyên đề [${num}]`,
            bold: true,
            size: 22,
            font: FONT_FAMILY,
            color: PRIMARY_COLOR,
          }),
          ...(uTime
            ? [
                new TextRun({
                  text: `  ·  Thời điểm truy vấn: ${uTime}`,
                  italics: true,
                  size: 18,
                  font: FONT_FAMILY,
                  color: MUTED_COLOR,
                }),
              ]
            : []),
        ],
      }),
    );

    // Khối câu hỏi / giả thuyết nghiên cứu
    const promptParagraphs = ex.userContent
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map(
        (l) =>
          new Paragraph({
            spacing: { after: 40, line: 260 },
            children: [
              new TextRun({
                text: l.trim(),
                size: 20,
                font: FONT_FAMILY,
                color: "0F172A",
              }),
            ],
          }),
      );

    bodyNodes.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "BAE6FD" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "BAE6FD" },
          left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT_SKY },
          right: { style: BorderStyle.SINGLE, size: 4, color: "BAE6FD" },
        },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                shading: { fill: "F0F9FF", type: ShadingType.CLEAR },
                margins: CELL_MARGINS,
                children: [
                  new Paragraph({
                    spacing: { after: 50 },
                    children: [
                      new TextRun({
                        text: "YÊU CẦU / GIẢ THUYẾT NGHIÊN CỨU",
                        bold: true,
                        size: 17,
                        font: FONT_FAMILY,
                        color: ACCENT_SKY,
                      }),
                    ],
                  }),
                  ...promptParagraphs,
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 80 }, children: [] }),
    );

    if (ex.assistantContent) {
      const metaBits: string[] = [];
      if (ex.modelUsed) {
        metaBits.push(
          ex.fallbackApplied && ex.requestedModel && ex.requestedModel !== ex.modelUsed
            ? `Mô hình thực thi: ${ex.modelUsed} (chuyển dự phòng từ ${ex.requestedModel})`
            : `Mô hình thực thi: ${ex.modelUsed}`,
        );
      }
      if (aTime) metaBits.push(`Hoàn tất lúc ${aTime}`);
      if (ex.evidence && ex.evidence.documents > 0) {
        metaBits.push(`Đối chiếu ${ex.evidence.documents} tệp (${ex.evidence.includedUnits}/${ex.evidence.totalUnits} đoạn)`);
      }

      bodyNodes.push(
        new Paragraph({
          keepNext: true,
          spacing: { before: 40, after: 80 },
          children: [
            new TextRun({
              text: "PHÂN TÍCH & GIẢI TRÌNH KHOA HỌC",
              bold: true,
              size: 18,
              font: FONT_FAMILY,
              color: ACCENT_TEAL,
            }),
            ...(metaBits.length > 0
              ? [
                  new TextRun({
                    text: `   |   ${metaBits.join(" · ")}`,
                    italics: true,
                    size: 17,
                    font: FONT_FAMILY,
                    color: MUTED_COLOR,
                  }),
                ]
              : []),
          ],
        }),
        ...renderBlocksToDocx(parseMarkdownBlocks(ex.assistantContent)),
      );
    } else {
      bodyNodes.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: "Ghi nhận hệ thống: Lượt truy vấn này chưa có phản hồi hoàn chỉnh từ máy chủ AI.",
              italics: true,
              size: 19,
              font: FONT_FAMILY,
              color: MUTED_COLOR,
            }),
          ],
        }),
      );
    }
  });

  // Mục IV: Khuyến nghị kiểm chứng thực nghiệm & Kiểm soát EHS
  bodyNodes.push(
    createSectionBanner("IV. KHUYẾN NGHỊ KIỂM CHỨNG THỰC NGHIỆM & KIỂM SOÁT AN TOÀN (EHS / QA)"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY_COLOR },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY_COLOR },
        left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      },
      rows: [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              shading: { fill: PRIMARY_COLOR, type: ShadingType.CLEAR },
              margins: CELL_MARGINS,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Hạng mục kiểm soát", bold: true, size: 18, font: FONT_FAMILY, color: "FFFFFF" })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              shading: { fill: PRIMARY_COLOR, type: ShadingType.CLEAR },
              margins: CELL_MARGINS,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "Yêu cầu thực hiện trước khi phê duyệt áp dụng", bold: true, size: 18, font: FONT_FAMILY, color: "FFFFFF" })],
                }),
              ],
            }),
          ],
        }),
        createMetaRow(
          "1. Thử nghiệm thực nghiệm (Bench / Pilot Test)",
          "Mọi thay đổi về công thức, tỷ lệ pha trộn hoặc quy trình công nghệ phải được thử nghiệm trên quy mô mẫu nhỏ (bench scale / pilot) có đối chứng chỉ tiêu kỹ thuật trước khi áp dụng sản xuất.",
        ),
        createMetaRow(
          "2. An toàn lao động & Môi trường (EHS / PPE)",
          "Đảm bảo hệ thống thông gió cục bộ / chống tĩnh điện đạt chuẩn đối với dung môi dễ cháy; trang bị đầy đủ PPE phù hợp (găng tay kháng dung môi Nitrile/Butyl, kính bảo hộ kín, mặt nạ lọc hơi hữu cơ) theo đúng SDS gốc.",
        ),
        createMetaRow(
          "3. Đối chiếu hồ sơ gốc & Lớp OCR",
          "Trước khi ban hành SOP chính thức, đối chiếu trực tiếp các thông số định lượng (CAS, nồng độ, nhiệt độ chớp cháy, OEL/TWA) với tệp PDF/tài liệu gốc do nhà cung cấp ban hành.",
        ),
      ],
    }),
  );

  // Mục V: Xác nhận & Phê duyệt báo cáo
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          createSignatureCell("NGƯỜI LẬP BÁO CÁO", "(Ký, ghi rõ họ tên)"),
          createSignatureCell("CHUYÊN VIÊN THẨM ĐỊNH", "(Ký, ghi rõ họ tên)"),
          createSignatureCell("TRƯỞNG PHÒNG R&D / LAB LEAD", "(Ký duyệt & đóng dấu)"),
        ],
      }),
    ],
  });

  bodyNodes.push(
    createSectionBanner("V. XÁC NHẬN & PHÊ DUYỆT HỒ SƠ"),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      keepNext: true,
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: `Ngày ${exportDate.getDate()} tháng ${exportDate.getMonth() + 1} năm ${exportDate.getFullYear()}`,
          italics: true,
          size: 19,
          font: FONT_FAMILY,
          color: "334155",
        }),
      ],
    }),
    signatureTable,
  );

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: 21,
            color: TEXT_COLOR,
          },
          paragraph: {
            spacing: { line: 276 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134, // 20mm
              bottom: 1134, // 20mm
              left: 1418, // 25mm chuẩn văn bản kỹ thuật VN
              right: 1134, // 20mm
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Hồ sơ R&D · ${docCode} · ${cleanTitle.slice(0, 55)}${cleanTitle.length > 55 ? "…" : ""}`,
                    size: 16,
                    font: FONT_FAMILY,
                    color: "94A3B8",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Tài liệu lưu hành nội bộ R&D · Trang ",
                    size: 16,
                    font: FONT_FAMILY,
                    color: MUTED_COLOR,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: FONT_FAMILY,
                    bold: true,
                  }),
                  new TextRun({
                    text: " / ",
                    size: 16,
                    font: FONT_FAMILY,
                    color: MUTED_COLOR,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    font: FONT_FAMILY,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        },
        children: bodyNodes,
      },
    ],
  });
}

function createSignatureCell(title: string, note: string): TableCell {
  return new TableCell({
    width: { size: 33.3, type: WidthType.PERCENTAGE },
    borders: NO_CELL_BORDERS,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: title, bold: true, size: 19, font: FONT_FAMILY, color: "0F172A" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: note, italics: true, size: 17, font: FONT_FAMILY, color: MUTED_COLOR })],
      }),
      new Paragraph({ spacing: { before: 700 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "........................................", size: 16, font: FONT_FAMILY, color: "94A3B8" })],
      }),
    ],
  });
}

/**
 * Tạo tài liệu Word (.docx) dạng Blob cho client trình duyệt
 */
export async function generateScientificWordDocument(session: ChatSession): Promise<Blob> {
  return await Packer.toBlob(buildScientificWordDoc(session));
}

/**
 * Tạo tài liệu Word (.docx) dạng Buffer cho API server
 */
export async function generateScientificWordBuffer(session: ChatSession): Promise<Buffer> {
  return await Packer.toBuffer(buildScientificWordDoc(session));
}

/**
 * Tạo tài liệu HTML in ấn chuẩn khổ A4 phục vụ xuất PDF (Vector Sharp / Academic Layout)
 */
export function generateScientificPrintableHtml(session: ChatSession): string {
  const exchanges = groupDialogueExchanges(session.messages);
  const meaningfulExchanges = exchanges.filter(
    (ex) => Boolean(ex.assistantContent) || ex.userContent.length >= 40,
  );
  const displayExchanges = meaningfulExchanges.length > 0 ? meaningfulExchanges : exchanges;
  const cleanTitle = normalizeReportTitle(session.title);
  const docs = collectEvidenceDocumentList(session, exchanges);
  const summaryHtml = renderBlocksToHtml(parseMarkdownBlocks(extractExecutiveSummary(displayExchanges)));
  const docCode = formatDocCode(session);

  const exportDate = new Date(session.updatedAt || session.createdAt);
  const dateStr = exportDate.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = exportDate.toLocaleTimeString("vi-VN");
  const answeredCount = displayExchanges.filter((ex) => Boolean(ex.assistantContent)).length;

  const coverageMap = new Map<string, string>();
  for (const ex of exchanges) {
    for (const src of ex.evidence?.sources || []) {
      if (src.name && src.units?.length) {
        coverageMap.set(src.name, `Đã trích ${src.units.length} đoạn căn cứ`);
      }
    }
  }

  const evidenceRowsHtml = docs.length
    ? docs
        .map((name, idx) => {
          const code = `TL-${String(idx + 1).padStart(2, "0")}`;
          const note = coverageMap.get(name) || "Đưa vào ngữ cảnh đối chiếu";
          return `<tr>
            <td style="text-align:center">${idx + 1}</td>
            <td style="text-align:center"><code class="inline-code">${code}</code></td>
            <td>${escapeHtml(name)}</td>
            <td class="status-cell">${escapeHtml(note)}</td>
          </tr>`;
        })
        .join("")
    : "";

  const exchangesHtml = displayExchanges
    .map((ex, idx) => {
      const num = idx + 1;
      const uTime = ex.userTimestamp ? new Date(ex.userTimestamp).toLocaleTimeString("vi-VN") : "";
      const aTime = ex.assistantTimestamp ? new Date(ex.assistantTimestamp).toLocaleTimeString("vi-VN") : "";

      const metaBits: string[] = [];
      if (ex.modelUsed) {
        metaBits.push(
          ex.fallbackApplied && ex.requestedModel && ex.requestedModel !== ex.modelUsed
            ? `Mô hình: ${escapeHtml(ex.modelUsed)} (chuyển dự phòng từ ${escapeHtml(ex.requestedModel)})`
            : `Mô hình: ${escapeHtml(ex.modelUsed)}`,
        );
      }
      if (aTime) metaBits.push(`Hoàn tất lúc ${aTime}`);
      if (ex.evidence && ex.evidence.documents > 0) {
        metaBits.push(`Đối chiếu ${ex.evidence.documents} tệp (${ex.evidence.includedUnits}/${ex.evidence.totalUnits} đoạn)`);
      }

      const promptHtml = ex.userContent
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => `<p>${escapeHtml(l)}</p>`)
        .join("");

      const analysisHtml = ex.assistantContent
        ? `<div class="analysis-block">
             <div class="analysis-meta">
               <span class="analysis-label">PHÂN TÍCH & GIẢI TRÌNH KHOA HỌC</span>
               ${metaBits.length ? `<span class="meta-bits">${metaBits.join(" · ")}</span>` : ""}
             </div>
             <div class="analysis-body">${renderBlocksToHtml(parseMarkdownBlocks(ex.assistantContent))}</div>
           </div>`
        : `<p class="unanswered-note">Ghi nhận hệ thống: Lượt truy vấn này chưa có phản hồi hoàn chỉnh từ máy chủ AI.</p>`;

      return `<section class="topic-section">
        <div class="topic-header">
          <h3>Chuyên đề [${num}]</h3>
          ${uTime ? `<span class="topic-time">Truy vấn lúc ${uTime}</span>` : ""}
        </div>
        <div class="prompt-box">
          <div class="prompt-label">YÊU CẦU / GIẢ THUYẾT NGHIÊN CỨU</div>
          ${promptHtml}
        </div>
        ${analysisHtml}
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Báo cáo Khoa học ${escapeHtml(docCode)} - ${escapeHtml(cleanTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 15mm 18mm 20mm;
      @bottom-center {
        content: "Tài liệu nội bộ R&D · Trang " counter(page) " / " counter(pages);
        font-family: 'Times New Roman', serif;
        font-size: 9.5pt;
        color: #64748b;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11.5pt;
      line-height: 1.5;
      color: #1e293b;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .print-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 8mm 12mm;
    }
    .print-actions {
      text-align: center;
      margin-bottom: 18px;
      padding: 12px 16px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 10pt;
    }
    .print-btn {
      background: #1e3a8a;
      color: #fff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 10.5pt;
      font-weight: 600;
      cursor: pointer;
      margin-right: 10px;
    }
    .print-btn:hover { background: #1d4ed8; }
    .header-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 10px;
      margin-bottom: 18px;
    }
    .header-left h3 {
      margin: 0;
      font-size: 10.5pt;
      font-weight: bold;
      color: #1e3a8a;
      letter-spacing: 0.4px;
    }
    .header-left p { margin: 3px 0 0 0; font-size: 9.5pt; color: #64748b; }
    .header-right { text-align: right; }
    .header-right h3 { margin: 0; font-size: 10.5pt; font-weight: bold; color: #0f172a; }
    .header-right p {
      margin: 3px 0 0 0;
      font-size: 10pt;
      font-weight: bold;
      font-style: italic;
      color: #334155;
      border-bottom: 1px solid #64748b;
      display: inline-block;
      padding-bottom: 2px;
    }
    .report-title-box { text-align: center; margin: 18px 0 20px; }
    .report-eyebrow {
      font-size: 9pt;
      font-weight: bold;
      letter-spacing: 1px;
      color: #0f766e;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .report-title-box h1 {
      margin: 0;
      font-size: 16pt;
      font-weight: bold;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .report-title-box .subtitle {
      margin: 8px auto 0;
      max-width: 92%;
      font-size: 12pt;
      font-weight: bold;
      font-style: italic;
      color: #334155;
    }
    h2.section-heading {
      font-size: 12.5pt;
      font-weight: bold;
      color: #1e3a8a;
      border-bottom: 1.5px solid #1e3a8a;
      padding-bottom: 4px;
      margin: 22px 0 12px;
      text-transform: uppercase;
      page-break-after: avoid;
    }
    .meta-table, .md-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 10pt;
    }
    .meta-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      vertical-align: top;
    }
    .meta-table td.label {
      background: #f8fafc;
      font-weight: bold;
      width: 30%;
      color: #334155;
    }
    .table-caption {
      font-size: 10pt;
      font-weight: bold;
      font-style: italic;
      color: #334155;
      margin: 10px 0 6px;
    }
    .md-table th {
      background: #1e3a8a;
      color: #fff;
      font-weight: bold;
      padding: 7px 10px;
      border: 1px solid #1e3a8a;
    }
    .md-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      vertical-align: top;
    }
    .md-table tbody tr:nth-child(even) { background: #f8fafc; }
    .md-table tr { break-inside: avoid; }
    .status-cell { color: #0f766e; font-weight: 600; }
    .integrity-box {
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0f766e;
      background: #f8fafc;
      padding: 9px 12px;
      font-size: 10pt;
      margin-bottom: 14px;
      break-inside: avoid;
    }
    .summary-box {
      border: 1px solid #bfdbfe;
      border-left: 5px solid #1e3a8a;
      background: #f1f5f9;
      padding: 12px 14px;
      margin-bottom: 18px;
    }
    .topic-section { margin-bottom: 20px; }
    .topic-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 4px;
      margin: 14px 0 10px;
      page-break-after: avoid;
    }
    .topic-header h3 { margin: 0; font-size: 12pt; color: #1e3a8a; }
    .topic-time { font-size: 9.5pt; font-style: italic; color: #64748b; }
    .prompt-box {
      border: 1px solid #bae6fd;
      border-left: 4px solid #0369a1;
      background: #f0f9ff;
      padding: 9px 12px;
      margin-bottom: 12px;
      break-inside: avoid;
    }
    .prompt-label {
      font-size: 8.5pt;
      font-weight: bold;
      color: #0369a1;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }
    .prompt-box p { margin: 3px 0; font-size: 10.5pt; color: #0f172a; }
    .analysis-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: baseline;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    .analysis-label {
      font-size: 9pt;
      font-weight: bold;
      color: #0f766e;
      letter-spacing: 0.4px;
    }
    .meta-bits { font-size: 9pt; font-style: italic; color: #64748b; }
    .analysis-body { font-size: 11pt; text-align: justify; }
    .md-h1, .md-h2, .md-h3, .md-h4 {
      color: #1e3a8a;
      margin: 12px 0 5px;
      page-break-after: avoid;
    }
    .md-h1 { font-size: 13pt; }
    .md-h2 { font-size: 12pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
    .md-h3 { font-size: 11.5pt; color: #0f172a; }
    .md-h4 { font-size: 11pt; color: #334155; }
    .md-p { margin: 0 0 8px; }
    .md-list { margin: 4px 0 10px; padding-left: 22px; }
    .md-list li { margin-bottom: 4px; }
    .md-list li.level-1 { margin-left: 18px; }
    .md-list li.level-2 { margin-left: 36px; }
    .md-quote {
      margin: 8px 0;
      padding: 8px 12px;
      border-left: 4px solid #0369a1;
      background: #f8fafc;
      font-style: italic;
      color: #334155;
      break-inside: avoid;
    }
    .md-quote p { margin: 2px 0; }
    .md-code {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      font-family: Consolas, monospace;
      font-size: 9pt;
      white-space: pre-wrap;
      break-inside: avoid;
    }
    .md-hr { border: 0; border-top: 1px solid #cbd5e1; margin: 12px 0; }
    .inline-code {
      font-family: Consolas, monospace;
      font-size: 9.5pt;
      background: #f1f5f9;
      color: #991b1b;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .citation-tag {
      font-weight: bold;
      color: #0f766e;
      font-size: 10pt;
    }
    .unanswered-note { font-style: italic; color: #64748b; font-size: 10pt; }
    .date-line { text-align: right; font-style: italic; font-size: 10.5pt; margin: 12px 0 16px; }
    .signatures-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
      break-inside: avoid;
    }
    .signature-col { width: 31%; text-align: center; }
    .sig-title { font-weight: bold; font-size: 10pt; color: #0f172a; }
    .sig-note { font-size: 9pt; font-style: italic; color: #64748b; margin-bottom: 58px; }
    .sig-line { border-top: 1px dashed #94a3b8; width: 78%; margin: 0 auto; }
    @media print {
      .print-actions { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-container { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="print-actions">
      <button class="print-btn" onclick="window.print()">In Báo Cáo / Lưu PDF (A4)</button>
      <span>Chọn <strong>"Lưu dưới dạng PDF" (Save as PDF)</strong> trong hộp thoại in để xuất bản PDF chuẩn học thuật.</span>
    </div>

    <div class="header-grid">
      <div class="header-left">
        <h3>HỆ THỐNG TRỢ LÝ NGHIÊN CỨU KHOA HỌC</h3>
        <p>PHÒNG R&amp;D · MÃ HỒ SƠ: ${escapeHtml(docCode)}</p>
      </div>
      <div class="header-right">
        <h3>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
        <p>Độc lập - Tự do - Hạnh phúc</p>
      </div>
    </div>

    <div class="report-title-box">
      <div class="report-eyebrow">HỒ SƠ PHÂN TÍCH KỸ THUẬT &amp; THẨM ĐỊNH AN TOÀN R&amp;D</div>
      <h1>BÁO CÁO KẾT QUẢ ĐỐI THOẠI &amp; PHÂN TÍCH KHOA HỌC</h1>
      <p class="subtitle">Đề tài: ${escapeHtml(cleanTitle)}</p>
    </div>

    <h2 class="section-heading">I. HỒ SƠ NGHIÊN CỨU &amp; DANH MỤC TÀI LIỆU CĂN CỨ</h2>
    <table class="meta-table">
      <tr><td class="label">Mã hồ sơ / Phiên lưu trữ:</td><td><code class="inline-code">${escapeHtml(docCode)}</code> (${escapeHtml(session.id)})</td></tr>
      <tr><td class="label">Thời gian khởi tạo:</td><td>${new Date(session.createdAt).toLocaleString("vi-VN")}</td></tr>
      <tr><td class="label">Thời điểm hoàn tất báo cáo:</td><td>${escapeHtml(dateStr)}, ${escapeHtml(timeStr)}</td></tr>
      <tr><td class="label">Mô hình AI chủ đạo:</td><td><strong>${escapeHtml(session.model || "deepseek-v4.1-flash")}</strong></td></tr>
      <tr><td class="label">Ngôn ngữ báo cáo:</td><td>${escapeHtml(formatLangLabel(session.language))}</td></tr>
      <tr><td class="label">Quy mô nội dung:</td><td>${answeredCount}/${displayExchanges.length} chuyên đề có phân tích hoàn chỉnh (${docs.length} tài liệu căn cứ)</td></tr>
    </table>

    ${
      docs.length
        ? `<div class="table-caption">Bảng 1. Danh mục tài liệu khoa học / SDS / MSDS làm căn cứ đối chiếu</div>
           <table class="md-table">
             <thead><tr><th style="width:8%;text-align:center">STT</th><th style="width:16%;text-align:center">Mã TL</th><th>Tên tệp tài liệu</th><th style="width:26%">Trạng thái đối chiếu</th></tr></thead>
             <tbody>${evidenceRowsHtml}</tbody>
           </table>`
        : ""
    }

    <div class="integrity-box">
      <strong>Nguyên tắc toàn vẹn dữ liệu:</strong> Mọi thông số kỹ thuật (số CAS, nồng độ %, điểm chớp cháy, mã nguy hại GHS H/P, giới hạn phơi nhiễm TWA/STEL, PPE) được đối chiếu trực tiếp từ các tệp nguồn nêu trên; tách bạch giữa dữ kiện tài liệu với suy luận chuyên môn.
    </div>

    <h2 class="section-heading">II. TÓM TẮT ĐIỀU HÀNH &amp; KẾT LUẬN CHÍNH</h2>
    <div class="summary-box">
      ${summaryHtml}
    </div>

    <h2 class="section-heading">III. NỘI DUNG PHÂN TÍCH KHOA HỌC &amp; KỸ THUẬT CHI TIẾT</h2>
    ${exchangesHtml}

    <h2 class="section-heading">IV. KHUYẾN NGHỊ KIỂM CHỨNG THỰC NGHIỆM &amp; KIỂM SOÁT AN TOÀN (EHS / QA)</h2>
    <table class="meta-table">
      <tr><td class="label">1. Thử nghiệm thực nghiệm (Bench / Pilot):</td><td>Thử nghiệm đối chứng ở quy mô mẫu nhỏ trước khi áp dụng chính thức vào quy trình sản xuất hoặc pha chế diện rộng.</td></tr>
      <tr><td class="label">2. An toàn hóa chất &amp; Bảo hộ (EHS / PPE):</td><td>Duy trì thông gió cục bộ / tiếp địa chống tĩnh điện đạt chuẩn; sử dụng PPE kháng dung môi hữu cơ (Nitrile/Butyl, kính kín, lọc hơi hữu cơ) theo SDS gốc.</td></tr>
      <tr><td class="label">3. Đối chiếu hồ sơ gốc &amp; OCR:</td><td>Kiểm tra đối chiếu các trị số định lượng (CAS, nồng độ, nhiệt độ chớp cháy, OEL) với bản gốc do nhà cung cấp ban hành.</td></tr>
    </table>

    <h2 class="section-heading">V. XÁC NHẬN &amp; PHÊ DUYỆT HỒ SƠ</h2>
    <div class="date-line">Ngày ${exportDate.getDate()} tháng ${exportDate.getMonth() + 1} năm ${exportDate.getFullYear()}</div>
    <div class="signatures-grid">
      <div class="signature-col">
        <div class="sig-title">NGƯỜI LẬP BÁO CÁO</div>
        <div class="sig-note">(Ký, ghi rõ họ tên)</div>
        <div class="sig-line"></div>
      </div>
      <div class="signature-col">
        <div class="sig-title">CHUYÊN VIÊN THẨM ĐỊNH</div>
        <div class="sig-note">(Ký, ghi rõ họ tên)</div>
        <div class="sig-line"></div>
      </div>
      <div class="signature-col">
        <div class="sig-title">TRƯỞNG PHÒNG R&amp;D / LAB LEAD</div>
        <div class="sig-note">(Ký duyệt &amp; đóng dấu)</div>
        <div class="sig-line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Kích hoạt mở trang in chuẩn A4 để người dùng xuất/lưu file PDF
 */
export function openScientificPdfPrintView(session: ChatSession): void {
  const html = generateScientificPrintableHtml(session);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
