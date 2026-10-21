"use client";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, FileText, LoaderCircle, Paperclip, ScanLine, Trash2, Upload, X } from "lucide-react";
import { deleteDocument, saveDocument } from "@/lib/document-store";
import { MAX_DOCUMENTS, selectDocumentEvidence, type StoredDocument } from "@/lib/research-documents";

export type SourceLocation = { documentId: string; unitId?: string };
function sizeLabel(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`; }

export default function ResearchSources({ documents, enabled, onDocuments, onEnabled, onView, onBusy, query }: {
  documents: StoredDocument[]; enabled: string[]; onDocuments: (documents: StoredDocument[]) => void;
  onEnabled: (ids: string[]) => void; onView: (location: SourceLocation) => void; onBusy: (busy: boolean) => void; query: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ file: string; detail: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [ocrAll, setOcrAll] = useState(false);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => () => { controller.current?.abort(); onBusy(false); }, [onBusy]);
  const evidence = selectDocumentEvidence(documents.filter((doc) => enabled.includes(doc.id)), query);
  const totalUnits = evidence.reduce((n, doc) => n + doc.totalUnits, 0);
  const sentUnits = evidence.reduce((n, doc) => n + doc.units.length, 0);
  const importFiles = async (files: File[], forceOcr = false) => {
    if (busyRef.current || !files.length) return;
    if (files.length > MAX_DOCUMENTS) { setErrors([`Mỗi lần nhập tối đa ${MAX_DOCUMENTS} file.`]); return; }
    busyRef.current = true; setBusy(true); onBusy(true); setErrors([]);
    const abort = new AbortController(); controller.current = abort;
    let currentDocuments = [...documents], currentEnabled = [...enabled];
    try {
      const { readResearchFile } = await import("@/lib/document-reader");
      for (const file of files) {
        if (abort.signal.aborted) break;
        setProgress({ file: file.name, detail: "Kiểm tra và đọc toàn bộ tài liệu…" });
        try {
          const result = await readResearchFile(file, {
            ocrAllPages: forceOcr || ocrAll, signal: abort.signal,
            onProgress: (detail) => { if (!abort.signal.aborted) setProgress({ file: file.name, detail }); },
          });
          if (abort.signal.aborted) break;
          const duplicate = currentDocuments.some((doc) => doc.id === result.id);
          if (!duplicate && currentDocuments.length >= MAX_DOCUMENTS) throw new Error(`Thư viện tài liệu đã đủ ${MAX_DOCUMENTS} file. Xóa bớt file để nhập thêm.`);
          const stored = { ...result, original: file };
          await saveDocument(stored);
          currentDocuments = [...currentDocuments.filter((doc) => doc.id !== stored.id), stored];
          currentEnabled = [...new Set([...currentEnabled, stored.id])];
          onDocuments(currentDocuments); onEnabled(currentEnabled);
        } catch (error) {
          if (abort.signal.aborted) break;
          setErrors((previous) => [...previous, `${file.name}: ${error instanceof Error ? error.message : "Không đọc được tài liệu."}`]);
        }
      }
    } finally {
      if (!abort.signal.aborted) setProgress(null);
      else setProgress({ file: "Đã dừng đọc", detail: "Các file đã đọc xong vẫn được giữ." });
      busyRef.current = false; setBusy(false); onBusy(false); controller.current = null;
    }
  };
  const remove = async (id: string) => {
    try {
      await deleteDocument(id); onDocuments(documents.filter((doc) => doc.id !== id)); onEnabled(enabled.filter((value) => value !== id));
    } catch (error) { setErrors([error instanceof Error ? error.message : "Không xóa được file."]); }
  };
  return <section className="research-sources" aria-label="Tài liệu nghiên cứu">
    <div className="sources-heading">
      <div><Paperclip size={21} /><div><h2>Tài liệu làm căn cứ nghiên cứu <span>{documents.length}</span></h2><p>SDS, MSDS, TDS, báo cáo và dữ liệu của anh</p></div></div>
      <button className="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Thu gọn" : "Mở tài liệu"}</button>
    </div>
    {expanded && <>
      <div className={"source-dropzone " + (dragging ? "dragging" : "")}
        onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) void importFiles(Array.from(event.dataTransfer.files)); }}>
        <Upload size={26} /><div><strong>Kéo thả file vào đây hoặc chọn từ máy</strong><p>PDF · Word DOC/DOCX · Excel XLS/XLSX · CSV · Tối đa 30 MB/file</p></div>
        <button className="button secondary" disabled={busy} onClick={() => input.current?.click()}><Paperclip size={16} />Chọn tài liệu</button>
        <input ref={input} className="visually-hidden" type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.csv"
          aria-label="Tải tài liệu nghiên cứu" onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void importFiles(files); }} />
      </div>
      <div className="source-import-options">
        <label><input type="checkbox" checked={ocrAll} disabled={busy} onChange={(event) => setOcrAll(event.target.checked)} /><ScanLine size={16} />OCR toàn bộ trang PDF khi nhập</label>
        <span>Mặc định tự OCR trang scan hoặc thiếu chữ. OCR toàn bộ phù hợp PDF có chữ trong ảnh xen kẽ.</span>
      </div>
      {progress && <div className="source-progress" role="status"><div>{busy && <LoaderCircle size={18} className="spin" />}<span><strong>{progress.file}</strong><small>{progress.detail}</small></span></div>{busy && <button className="text-button" onClick={() => controller.current?.abort()}>Dừng đọc</button>}</div>}
      {errors.length > 0 && <div className="notice danger" role="alert"><AlertCircle size={18} /><div>{errors.map((error, index) => <p key={index}>{error}</p>)}</div></div>}
      {documents.length > 0 && <div className="source-file-list">{documents.map((doc) => {
        const ocrPages = doc.units.filter((unit) => unit.method === "ocr").length;
        return <article className="source-file-card" key={doc.id}>
          <div className="source-file-top">
            <label><input type="checkbox" checked={enabled.includes(doc.id)} disabled={busy} onChange={(event) => onEnabled(event.target.checked ? [...enabled, doc.id] : enabled.filter((id) => id !== doc.id))} aria-label={"Dùng làm căn cứ: " + doc.name} />
              {doc.format === "xls" || doc.format === "xlsx" || doc.format === "csv" ? <FileSpreadsheet size={22} /> : <FileText size={22} />}
              <span><strong>{doc.name}</strong><small>{doc.format.toUpperCase()} · {sizeLabel(doc.size)} · Đã xử lý {doc.processedCount}/{doc.unitCount} {doc.format === "pdf" ? "trang" : "phần"}{ocrPages ? ` · ${ocrPages} đoạn OCR` : ""}</small></span>
            </label>
            <button className="icon-button" disabled={busy} aria-label={"Xóa tài liệu " + doc.name} onClick={() => void remove(doc.id)}><Trash2 size={16} /></button>
          </div>
          <div className="source-file-actions"><button className="text-button" onClick={() => onView({ documentId: doc.id })}>Kiểm tra nội dung đã đọc</button>{doc.format === "pdf" && <button className="text-button" disabled={busy} onClick={() => void importFiles([new File([doc.original], doc.name, { type: "application/pdf" })], true)}>Đọc lại bằng OCR toàn bộ</button>}</div>
          {doc.warnings.length > 0 && <details className="source-warnings"><summary><AlertCircle size={13} />Lưu ý khi dùng tài liệu ({doc.warnings.length})</summary><ul>{doc.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
        </article>;
      })}</div>}
      <div className="sources-footer"><CheckCircle2 size={16} /><span>{evidence.length ? `${evidence.length} file đang chọn · ${sentUnits}/${totalUnits} đoạn sẽ gửi cùng câu hỏi${sentUnits < totalUnits ? " (chọn phần liên quan theo câu hỏi; bản đầy đủ vẫn được lưu)" : ""}.` : "Chọn file để trợ lý dùng làm căn cứ."} Lưu tại trình duyệt này. Khi gửi câu hỏi, phần văn bản được gửi đến dịch vụ AI đã cấu hình. DOC cũ cần đăng nhập, tối đa 3,5 MB và được đọc qua máy chủ ứng dụng.</span></div>
    </>}
  </section>;
}

export function SourcePreview({ document, location, onClose }: { document: StoredDocument; location: SourceLocation; onClose: () => void }) {
  const [unitId, setUnitId] = useState(location.unitId || document.units[0]?.id || "");
  const [search, setSearch] = useState("");
  useEffect(() => { setUnitId(location.unitId || document.units[0]?.id || ""); setSearch(""); }, [location, document]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape); }, [onClose]);
  const matches = document.units.filter((unit) => (unit.locator + " " + unit.text).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const selected = matches.find((unit) => unit.id === unitId) || matches[0];
  const download = (original: boolean) => {
    const blob = original ? document.original : new Blob(["\ufeff" + document.units.map((unit) => `=== ${unit.locator} ===\n${unit.text}`).join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = window.document.createElement("a");
    anchor.href = url; anchor.download = original ? document.name : document.name + ".txt"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  return <div className="modal-backdrop" onClick={onClose}><section className="source-preview-modal" role="dialog" aria-modal="true" aria-labelledby="source-preview-title" onClick={(event) => event.stopPropagation()}>
    <div className="modal-header"><div><h2 id="source-preview-title">{document.name}</h2><span>Đã xử lý {document.processedCount}/{document.unitCount} {document.format === "pdf" ? "trang" : "phần"} · {document.units.length} đoạn</span></div><button autoFocus className="icon-button" aria-label="Đóng nội dung tài liệu" onClick={onClose}><X size={20} /></button></div>
    <div className="source-preview-tools"><input aria-label="Tìm trong tài liệu" placeholder="Tìm CAS, thành phần, pH, mã sản phẩm…" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Chọn trang, sheet hoặc phần" value={selected?.id || ""} onChange={(event) => setUnitId(event.target.value)}>{matches.map((unit) => <option key={unit.id} value={unit.id}>{unit.locator}{unit.method === "ocr" ? " · OCR" : ""}</option>)}</select></div>
    <div className="source-preview-body">{selected ? <><div className="source-locator"><strong>{selected.locator}</strong><span>{selected.method === "ocr" ? `OCR${selected.confidence !== undefined ? ` · ${Math.round(selected.confidence)}%` : ""} · Đối chiếu số và đơn vị với bản gốc` : "Văn bản trích xuất trực tiếp"}</span></div><pre>{selected.text || "Không có chữ trích xuất được ở phần này. Kiểm tra bản gốc và lưu ý đọc tài liệu."}</pre></> : <p>Không có đoạn phù hợp từ khóa.</p>}</div>
    <div className="document-footer"><span>Nội dung tài liệu là dữ liệu tham khảo; bố cục và hình vẽ xem trong bản gốc.</span><button className="button secondary" onClick={() => download(false)}><Download size={15} />Tải toàn bộ chữ đã đọc</button><button className="button primary" onClick={() => download(true)}><Download size={15} />Tải bản gốc</button></div>
  </section></div>;
}
