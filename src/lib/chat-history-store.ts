/**
 * Quản lý lưu trữ nhật ký hội thoại (Chat History Store)
 * Lưu trữ tự động các phiên đối thoại nghiên cứu vào IndexedDB (kèm fallback localStorage)
 * Cho phép xem lại lịch sử, tìm kiếm, khôi phục phiên cũ, và xuất báo cáo Markdown / JSON.
 */

import type { EvidenceReceipt } from "./research-documents";

export type ChatMessageItem = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  evidence?: EvidenceReceipt;
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
 * Xuất phiên hội thoại ra định dạng Markdown hoàn chỉnh kèm thời gian và nguồn dẫn.
 */
export function exportSessionToMarkdown(session: ChatSession): string {
  const lines: string[] = [];
  lines.push(`# ${session.title || "Nhật ký hội thoại nghiên cứu"}`);
  lines.push(`- **Thời gian tạo:** ${new Date(session.createdAt).toLocaleString("vi-VN")}`);
  lines.push(`- **Cập nhật lần cuối:** ${new Date(session.updatedAt).toLocaleString("vi-VN")}`);
  lines.push(`- **Mô hình AI:** \`${session.model}\``);
  lines.push(`- **Ngôn ngữ phản hồi:** ${session.language === "vi" ? "Tiếng Việt" : session.language === "zh" ? "中文" : "English"}`);
  if (session.documentNames && session.documentNames.length > 0) {
    lines.push(`- **Tài liệu căn cứ:** ${session.documentNames.join(", ")}`);
  }
  lines.push("\n---\n");

  for (const msg of session.messages) {
    const roleTitle = msg.role === "user" ? "### 👤 Câu hỏi của bạn" : "### 🤖 Trợ lý Nghiên cứu (Research Agent)";
    lines.push(roleTitle);
    if (msg.timestamp) {
      lines.push(`*(${new Date(msg.timestamp).toLocaleTimeString("vi-VN")})*\n`);
    }
    lines.push(msg.content);
    lines.push("\n");
  }

  return lines.join("\n");
}

export {
  generateScientificWordDocument,
  generateScientificPrintableHtml,
  openScientificPdfPrintView,
} from "./scientific-export";
