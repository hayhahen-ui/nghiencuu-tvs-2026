import type { StoredDocument } from "./research-documents";

function database(): Promise<IDBDatabase> {
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
