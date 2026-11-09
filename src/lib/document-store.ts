import type { StoredDocument } from "./research-documents";

/**
 * Đảm bảo trình duyệt cấp quyền lưu trữ vĩnh viễn (Persistent Storage)
 * Không bị trình duyệt tự động xóa khi máy tính thiếu dung lượng ổ đĩa.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        return await navigator.storage.persist();
      }
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function database(): Promise<IDBDatabase> {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    void navigator.storage.persist().catch(() => {});
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("research-source-documents", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Không mở được bộ nhớ tài liệu của trình duyệt."));
  });
}

export async function loadDocuments(): Promise<StoredDocument[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("documents").objectStore("documents").getAll();
      request.onsuccess = () => resolve(request.result as StoredDocument[]);
      request.onerror = () => reject(new Error("Không đọc được tài liệu đã lưu."));
    });
  } finally { db.close(); }
}

export async function saveDocument(document: StoredDocument) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("documents", "readwrite");
      transaction.objectStore("documents").put(document);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("Không lưu được tài liệu. Kiểm tra dung lượng trống của trình duyệt."));
      transaction.onabort = () => reject(new Error("Lưu tài liệu bị hủy; hãy thử lại."));
    });
  } finally { db.close(); }
}

export async function deleteDocument(id: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("documents", "readwrite");
      transaction.objectStore("documents").delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("Không xóa được tài liệu đã lưu."));
    });
  } finally { db.close(); }
}

/**
 * Xuất bản sao lưu thư viện tài liệu đã OCR và xử lý GHS (dưới dạng file JSON).
 * Giúp nhà nghiên cứu chuyển thư viện sang máy tính hoặc trình duyệt khác mà không cần scan/OCR lại từ đầu.
 */
export function exportDocumentsBackup(documents: StoredDocument[]) {
  const payload = {
    app: "ResearchAgent-MSDS",
    version: 1,
    exportedAt: new Date().toISOString(),
    count: documents.length,
    documents: documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      format: doc.format,
      size: doc.size,
      importedAt: doc.importedAt,
      unitCount: doc.unitCount,
      processedCount: doc.processedCount,
      units: doc.units,
      warnings: doc.warnings,
    })),
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `msds-library-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Nạp lại thư viện tài liệu từ file sao lưu JSON vào IndexedDB.
 */
export async function importDocumentsBackup(file: File): Promise<StoredDocument[]> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.documents)) {
    throw new Error("File sao lưu không đúng định dạng thư viện tài liệu.");
  }
  const restored: StoredDocument[] = [];
  for (const doc of data.documents) {
    if (!doc.id || !doc.name || !Array.isArray(doc.units)) continue;
    const blob = new Blob([doc.units.map((u: any) => u.text || "").join("\n\n")], { type: "text/plain" });
    const storedDoc: StoredDocument = {
      id: doc.id,
      name: doc.name,
      format: doc.format || "pdf",
      size: doc.size || 0,
      importedAt: doc.importedAt || new Date().toISOString(),
      unitCount: doc.unitCount || doc.units.length,
      processedCount: doc.processedCount || doc.units.length,
      units: doc.units,
      warnings: Array.isArray(doc.warnings) ? doc.warnings : [],
      original: blob,
    };
    await saveDocument(storedDoc);
    restored.push(storedDoc);
  }
  return restored;
}
