/**
 * Quản lý lưu trữ nhật ký hội thoại (Chat History Store)
 * Lưu trữ tự động các phiên đối thoại nghiên cứu vào IndexedDB (kèm fallback localStorage)
 * Cho phép xem lại lịch sử, tìm kiếm, khôi phục phiên cũ, và xuất báo cáo Markdown / JSON.
 */

import type { EvidenceReceipt } from "./research-documents";
import {
  collectEvidenceDocumentList,
  extractExecutiveSummary,
  groupDialogueExchanges,
  normalizeReportTitle,
} from "./report-formatter";

export type ChatMessageItem = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  evidence?: EvidenceReceipt;
  model?: string;
  requestedModel?: string;
  fallbackApplied?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  language: "vi" | "en" | "zh";
  messages: ChatMessageItem[];
  skillsUsed?: string[];
  documentNames?: string[];
};

const DB_NAME = "research-chat-history";
const STORE_NAME = "chat_sessions";
const FALLBACK_KEY = "research_agent_chat_sessions_backup";

function getDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB không được hỗ trợ trên môi trường này."));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Không thể mở cơ sở dữ liệu nhật ký chat."));
  });
}

/**
 * Tải toàn bộ danh sách các phiên chat đã lưu, sắp xếp phiên mới nhất lên đầu.
 */
export async function loadChatSessions(): Promise<ChatSession[]> {
  try {
    const db = await getDatabase();
    return await new Promise<ChatSession[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as ChatSession[]) || [];
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback sang localStorage nếu IndexedDB lỗi
    if (typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatSession[];
          parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          return parsed;
        }
      } catch {}
    }
    return [];
  }
}

/**
 * Lưu hoặc cập nhật một phiên chat.
 */
export async function saveChatSession(session: ChatSession): Promise<void> {
  const updatedSession: ChatSession = {
    ...session,
    updatedAt: new Date().toISOString(),
  };

  try {
    const db = await getDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(updatedSession);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}

  // Luôn đồng bộ một bản dự phòng vào localStorage
  if (typeof localStorage !== "undefined") {
    try {
      const current = await loadChatSessionsFromStorage();
      const next = [updatedSession, ...current.filter((s) => s.id !== updatedSession.id)].slice(0, 50);
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(next));
    } catch {}
  }
}

function loadChatSessionsFromStorage(): ChatSession[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

/**
 * Xóa một phiên chat theo ID.
 */
export async function deleteChatSession(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}

  if (typeof localStorage !== "undefined") {
    try {
      const current = loadChatSessionsFromStorage();
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(current.filter((s) => s.id !== id)));
    } catch {}
  }
}

/**
 * Xóa toàn bộ lịch sử chat.
 */
export async function clearAllChatSessions(): Promise<void> {
  try {
    const db = await getDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(FALLBACK_KEY);
    } catch {}
  }
}

/**
 * Xuất phiên hội thoại ra định dạng Báo cáo Khoa học Markdown chuẩn chỉnh,
 * đã lọc JSON thô/thông báo hệ thống và gộp các lượt gửi lại do lỗi mạng.
 */
export function exportSessionToMarkdown(session: ChatSession): string {
  const exchanges = groupDialogueExchanges(session.messages);
  const cleanTitle = normalizeReportTitle(session.title);
  const docs = collectEvidenceDocumentList(session, exchanges);
  const summary = extractExecutiveSummary(exchanges);

  const lines: string[] = [];
  lines.push(`# BÁO CÁO PHÂN TÍCH & THẨM ĐỊNH KHOA HỌC`);
  lines.push(`**Đề tài:** ${cleanTitle}`);
  lines.push("");
  lines.push("| Thông số hồ sơ | Chi tiết |");
  lines.push("| --- | --- |");
  lines.push(`| Mã phiên lưu trữ | \`${session.id}\` |`);
  lines.push(`| Thời gian tạo | ${new Date(session.createdAt).toLocaleString("vi-VN")} |`);
  lines.push(`| Cập nhật lần cuối | ${new Date(session.updatedAt).toLocaleString("vi-VN")} |`);
  lines.push(`| Mô hình AI xử lý | \`${session.model}\` |`);
  lines.push(`| Ngôn ngữ báo cáo | ${session.language === "vi" ? "Tiếng Việt" : session.language === "zh" ? "中文" : "English"} |`);
  lines.push(`| Tài liệu căn cứ | ${docs.length > 0 ? docs.join("; ") : "Không đính kèm tệp"} |`);
  lines.push("");
  lines.push("## I. TÓM TẮT ĐIỀU HÀNH & KẾT LUẬN CHÍNH");
  lines.push("");
  lines.push(summary);
  lines.push("");
  lines.push("## II. NỘI DUNG PHÂN TÍCH KHOA HỌC & KỸ THUẬT CHI TIẾT");
  lines.push("");

  for (const ex of exchanges) {
    if (!ex.assistantContent && ex.userContent.length < 40) continue;
    const uTime = ex.userTimestamp ? ` (${new Date(ex.userTimestamp).toLocaleTimeString("vi-VN")})` : "";
    const aTime = ex.assistantTimestamp ? ` (${new Date(ex.assistantTimestamp).toLocaleTimeString("vi-VN")})` : "";
    lines.push(`### Chuyên đề [${ex.index}]${uTime}`);
    lines.push("");
    lines.push(`> **Yêu cầu / Giả thuyết nghiên cứu:** ${ex.userContent}`);
    lines.push("");
    if (ex.assistantContent) {
      if (ex.modelUsed) {
        const switchInfo =
          ex.fallbackApplied && ex.requestedModel && ex.requestedModel !== ex.modelUsed
            ? ` (tự động chuyển từ \`${ex.requestedModel}\`)`
            : "";
        lines.push(`*Mô hình thực thi: \`${ex.modelUsed}\`${switchInfo}${aTime}*`);
        lines.push("");
      }
      lines.push(ex.assistantContent);
      lines.push("");
    } else {
      lines.push("*Chưa ghi nhận phản hồi hoàn chỉnh ở lượt truy vấn này.*");
      lines.push("");
    }
  }

  return lines.join("\n");
}

export {
  generateScientificWordDocument,
  generateScientificPrintableHtml,
  openScientificPdfPrintView,
} from "./scientific-export";
