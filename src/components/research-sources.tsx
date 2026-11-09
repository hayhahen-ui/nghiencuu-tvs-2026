"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  LoaderCircle,
  Paperclip,
  ScanLine,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { deleteDocument, saveDocument } from "@/lib/document-store";
import { MAX_DOCUMENTS, selectDocumentEvidence, type StoredDocument } from "@/lib/research-documents";
import { analyzeMsds, GHS_SECTIONS_DEF, type MsdsAnalysisResult } from "@/lib/msds-analyzer";

export type SourceLocation = { documentId: string; unitId?: string };
function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default function ResearchSources({
  documents,
  enabled,
  onDocuments,
  onEnabled,
  onView,
  onBusy,
  query,
}: {
  documents: StoredDocument[];
  enabled: string[];
  onDocuments: (documents: StoredDocument[]) => void;
  onEnabled: (ids: string[]) => void;
  onView: (location: SourceLocation) => void;
  onBusy: (busy: boolean) => void;
  query: string;
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
    if (files.length > MAX_DOCUMENTS) {
      setErrors([`Mỗi lần nhập tối đa ${MAX_DOCUMENTS} file.`]);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    onBusy(true);
    setErrors([]);
    const abort = new AbortController();
    controller.current = abort;
    let currentDocuments = [...documents], currentEnabled = [...enabled];
    try {
      const { readResearchFile } = await import("@/lib/document-reader");
      for (const file of files) {
        if (abort.signal.aborted) break;
        setProgress({ file: file.name, detail: "Kiểm tra và đọc toàn bộ tài liệu…" });
        try {
          const result = await readResearchFile(file, {
            ocrAllPages: forceOcr || ocrAll,
            signal: abort.signal,
            onProgress: (detail) => {
              if (!abort.signal.aborted) setProgress({ file: file.name, detail });
            },
          });
          if (abort.signal.aborted) break;
          const duplicate = currentDocuments.some((doc) => doc.id === result.id);
          if (!duplicate && currentDocuments.length >= MAX_DOCUMENTS) {
            throw new Error(`Thư viện tài liệu đã đủ ${MAX_DOCUMENTS} file. Xóa bớt file để nhập thêm.`);
          }
          const stored = { ...result, original: file };
          await saveDocument(stored);
          currentDocuments = [...currentDocuments.filter((doc) => doc.id !== stored.id), stored];
          currentEnabled = [...new Set([...currentEnabled, stored.id])];
          onDocuments(currentDocuments);
          onEnabled(currentEnabled);
        } catch (error) {
          if (abort.signal.aborted) break;
          setErrors((previous) => [...previous, `${file.name}: ${error instanceof Error ? error.message : "Không đọc được tài liệu."}`]);
        }
      }
    } finally {
      if (!abort.signal.aborted) setProgress(null);
      else setProgress({ file: "Đã dừng đọc", detail: "Các file đã đọc xong vẫn được giữ." });
      busyRef.current = false;
      setBusy(false);
      onBusy(false);
      controller.current = null;
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDocument(id);
      onDocuments(documents.filter((doc) => doc.id !== id));
      onEnabled(enabled.filter((value) => value !== id));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Không xóa được file."]);
    }
  };

  const loadSampleMsds = async (type: "docx" | "xlsx") => {
    if (busy) return;
    const url = type === "docx"
      ? "/samples/MSDS_Ethanol_99.5_GHS_VN_EN.docx"
      : "/samples/Chemical_Inventory_MSDS_Matrix.xlsx";
    const name = type === "docx"
      ? "MSDS_Ethanol_99.5_GHS_VN_EN.docx"
      : "Chemical_Inventory_MSDS_Matrix.xlsx";
    const mime = type === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    try {
      setProgress({ file: name, detail: "Đang tải file mẫu từ máy chủ…" });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Không thể tải file mẫu. Vui lòng thử lại.");
      const blob = await res.blob();
      const file = new File([blob], name, { type: mime });
      await importFiles([file]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Không thể nạp mẫu."]);
    }
  };

  return (
    <section className="research-sources" aria-label="Tài liệu nghiên cứu">
      <div className="sources-heading">
        <div>
          <Paperclip size={21} />
          <div>
            <h2>Tài liệu làm căn cứ nghiên cứu <span>{documents.length}</span></h2>
            <p>Hỗ trợ SDS, MSDS Hóa chất, TDS, Word (.docx/.doc), Excel (.xlsx/.xls/.csv), PDF</p>
          </div>
        </div>
        <button className="text-button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Thu gọn" : "Mở tài liệu"}
        </button>
      </div>

      {expanded && (
        <>
          <div
            className={"source-dropzone " + (dragging ? "dragging" : "")}
            onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) void importFiles(Array.from(event.dataTransfer.files)); }}
          >
            <Upload size={26} />
            <div>
              <strong>Kéo thả file vào đây hoặc chọn từ máy</strong>
              <p>PDF · Word DOC/DOCX · Excel XLS/XLSX · CSV · Tối đa 30 MB/file</p>
            </div>
            <button className="button secondary" disabled={busy} onClick={() => input.current?.click()}>
              <Paperclip size={16} />Chọn tài liệu
            </button>
            <input
              ref={input}
              className="visually-hidden"
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv"
              aria-label="Tải tài liệu nghiên cứu"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = "";
                void importFiles(files);
              }}
            />
          </div>

          <div className="source-sample-actions">
            <span>Mẫu kiểm nghiệm nhanh chuẩn GHS:</span>
            <button
              type="button"
              className="sample-pill-button"
              disabled={busy}
              onClick={() => void loadSampleMsds("docx")}
              title="Nạp mẫu Phiếu an toàn hóa chất Ethanol 99.5% GHS chuẩn 16 phần (Word .docx)"
            >
              <FlaskConical size={14} /> Nạp mẫu MSDS Ethanol 99.5% (Word .docx)
            </button>
            <button
              type="button"
              className="sample-pill-button"
              disabled={busy}
              onClick={() => void loadSampleMsds("xlsx")}
              title="Nạp mẫu Danh mục Hóa chất & Chỉ tiêu an toàn SDS (Excel .xlsx)"
            >
              <FileSpreadsheet size={14} /> Nạp mẫu Danh mục Hóa chất SDS (Excel .xlsx)
            </button>
          </div>

          <div className="source-import-options">
            <label>
              <input type="checkbox" checked={ocrAll} disabled={busy} onChange={(event) => setOcrAll(event.target.checked)} />
              <ScanLine size={16} />OCR toàn bộ trang PDF khi nhập
            </label>
            <span>Mặc định tự OCR trang scan hoặc thiếu chữ. OCR toàn bộ phù hợp PDF có chữ trong ảnh xen kẽ.</span>
          </div>

          {progress && (
            <div className="source-progress" role="status">
              <div>
                {busy && <LoaderCircle size={18} className="spin" />}
                <span>
                  <strong>{progress.file}</strong>
                  <small>{progress.detail}</small>
                </span>
              </div>
              {busy && <button className="text-button" onClick={() => controller.current?.abort()}>Dừng đọc</button>}
            </div>
          )}

          {errors.length > 0 && (
            <div className="notice danger" role="alert">
              <AlertCircle size={18} />
              <div>{errors.map((error, index) => <p key={index}>{error}</p>)}</div>
            </div>
          )}

          {documents.length > 0 && (
            <div className="source-file-list">
              {documents.map((doc) => {
                const ocrPages = doc.units.filter((unit) => unit.method === "ocr").length;
                const msds = analyzeMsds(doc);

                return (
                  <article className="source-file-card" key={doc.id}>
                    <div className="source-file-top">
                      <label>
                        <input
                          type="checkbox"
                          checked={enabled.includes(doc.id)}
                          disabled={busy}
                          onChange={(event) =>
                            onEnabled(event.target.checked ? [...enabled, doc.id] : enabled.filter((id) => id !== doc.id))
                          }
                          aria-label={"Dùng làm căn cứ: " + doc.name}
                        />
                        {doc.format === "xls" || doc.format === "xlsx" || doc.format === "csv" ? (
                          <FileSpreadsheet size={22} />
                        ) : (
                          <FileText size={22} />
                        )}
                        <span>
                          <strong>{doc.name}</strong>
                          <small>
                            {doc.format.toUpperCase()} · {sizeLabel(doc.size)} · Đã xử lý {doc.processedCount}/{doc.unitCount}{" "}
                            {doc.format === "pdf" ? "trang" : "phần"}
                            {ocrPages ? ` · ${ocrPages} đoạn OCR` : ""}
                          </small>
                        </span>
                      </label>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={"Xóa tài liệu " + doc.name}
                        onClick={() => void remove(doc.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {msds.isMsds && (
                      <div className="msds-badge-container">
                        <span className="msds-tag danger">
                          <ShieldAlert size={12} /> GHS SDS: {msds.chemical.signalWord || "HÓA CHẤT NGUY HẠI"}
                        </span>
                        {msds.chemical.casNumbers.length > 0 && (
                          <span className="msds-tag cas">CAS: {msds.chemical.casNumbers.slice(0, 2).join(", ")}</span>
                        )}
                        {msds.chemical.unNumbers.length > 0 && (
                          <span className="msds-tag un">{msds.chemical.unNumbers[0]}</span>
                        )}
                        {msds.chemical.hazardCodes.length > 0 && (
                          <span className="msds-tag hazard">
                            {msds.chemical.hazardCodes.map((h) => h.code).slice(0, 3).join(", ")}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="source-file-actions">
                      <button className="text-button" onClick={() => onView({ documentId: doc.id })}>
                        {msds.isMsds ? "Tra cứu MSDS & nội dung" : "Kiểm tra nội dung đã đọc"}
                      </button>
                      {doc.format === "pdf" && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => void importFiles([new File([doc.original], doc.name, { type: "application/pdf" })], true)}
                        >
                          Đọc lại bằng OCR toàn bộ
                        </button>
                      )}
                    </div>

                    {doc.warnings.length > 0 && (
                      <details className="source-warnings">
                        <summary>
                          <AlertCircle size={13} />
                          Lưu ý khi dùng tài liệu ({doc.warnings.length})
                        </summary>
                        <ul>
                          {doc.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className="sources-footer">
            <CheckCircle2 size={16} />
            <span>
              {evidence.length
                ? `${evidence.length} file đang chọn · ${sentUnits}/${totalUnits} đoạn sẽ gửi cùng câu hỏi${
                    sentUnits < totalUnits ? " (chọn phần liên quan theo câu hỏi; bản đầy đủ vẫn được lưu)" : ""
                  }.`
                : "Chọn file để trợ lý dùng làm căn cứ."}{" "}
              Lưu tại trình duyệt này. Khi gửi câu hỏi, dữ liệu an toàn hóa chất GHS và văn bản liên quan sẽ được tự động tổng hợp gửi đến mô hình AI.
            </span>
          </div>
        </>
      )}
    </section>
  );
}

export function SourcePreview({
  document,
  location,
  onClose,
}: {
  document: StoredDocument;
  location: SourceLocation;
  onClose: () => void;
}) {
  const [unitId, setUnitId] = useState(location.unitId || document.units[0]?.id || "");
  const [search, setSearch] = useState("");
  const [showPage, setShowPage] = useState(false);
  const [viewMode, setViewMode] = useState<"text" | "msds">("text");

  const msds = useMemo(() => analyzeMsds(document), [document]);

  useEffect(() => {
    setUnitId(location.unitId || document.units[0]?.id || "");
    setSearch("");
  }, [location, document]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const matches = document.units.filter((unit) =>
    (unit.locator + " " + unit.text).toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );
  const selected = matches.find((unit) => unit.id === unitId) || matches[0];

  const jumpToLocator = (locator?: string) => {
    if (!locator) return;
    const target = document.units.find((u) => u.locator === locator);
    if (target) {
      setUnitId(target.id);
      setViewMode("text");
    }
  };

  const download = (original: boolean) => {
    const blob = original
      ? document.original
      : new Blob(
          ["\ufeff" + document.units.map((unit) => `=== ${unit.locator} ===\n${unit.text}`).join("\n\n")],
          { type: "text/plain;charset=utf-8" }
        );
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = original ? document.name : document.name + ".txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="source-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="source-preview-title">{document.name}</h2>
            <span>
              Đã xử lý {document.processedCount}/{document.unitCount}{" "}
              {document.format === "pdf" ? "trang" : "phần"} · {document.units.length} đoạn
              {msds.isMsds ? " · Đã chuẩn hóa 16 mục GHS SDS" : ""}
            </span>
          </div>
          <button autoFocus className="icon-button" aria-label="Đóng nội dung tài liệu" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {msds.isMsds && (
          <div style={{ display: "flex", gap: "8px", padding: "10px 20px 0" }}>
            <button
              className={`msds-view-tab-btn ${viewMode === "text" ? "active" : ""}`}
              onClick={() => setViewMode("text")}
            >
              <FileText size={14} /> Văn bản trích xuất gốc
            </button>
            <button
              className={`msds-view-tab-btn ${viewMode === "msds" ? "active" : ""}`}
              onClick={() => setViewMode("msds")}
            >
              <ShieldAlert size={14} /> Bảng an toàn hóa chất GHS (16 mục chuẩn)
            </button>
          </div>
        )}

        {viewMode === "msds" && msds.isMsds ? (
          <div className="source-preview-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
            <div className="msds-executive-dashboard">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink)" }}>
                    🧪 {msds.productName}
                  </h3>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                    {msds.chemical.signalWord && (
                      <span className="msds-tag danger">{msds.chemical.signalWord}</span>
                    )}
                    {msds.chemical.casNumbers.length > 0 && (
                      <span className="msds-tag cas">CAS: {msds.chemical.casNumbers.join(", ")}</span>
                    )}
                    {msds.chemical.unNumbers.length > 0 && (
                      <span className="msds-tag un">{msds.chemical.unNumbers.join(", ")}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Độ tin cậy nhận diện: <strong style={{ color: "#059669" }}>{msds.confidenceScore}%</strong>
                </div>
              </div>

              <div className="msds-param-grid">
                <div className="msds-param-card">
                  <strong>Tính chất lý hóa chủ chốt</strong>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>
                    Sôi: {msds.chemical.physicalProperties.boilingPoint || "N/A"}<br />
                    Chớp cháy: {msds.chemical.physicalProperties.flashPoint || "N/A"}<br />
                    Tỷ trọng: {msds.chemical.physicalProperties.density || "N/A"}<br />
                    pH: {msds.chemical.physicalProperties.pH || "N/A"}
                  </p>
                </div>
                <div className="msds-param-card">
                  <strong>Trang bị bảo hộ (PPE)</strong>
                  <p style={{ margin: 0, lineHeight: 1.4 }}>
                    {msds.chemical.ppeRecommendations.length > 0
                      ? msds.chemical.ppeRecommendations.join(" ")
                      : "Trang bị kính, găng tay chống hóa chất và thao tác trong tủ hút."}
                  </p>
                </div>
                <div className="msds-param-card">
                  <strong>Chất tương kỵ / Tránh tiếp xúc</strong>
                  <p style={{ margin: 0, lineHeight: 1.4, color: "#b91c1c" }}>
                    {msds.chemical.incompatibilities.length > 0
                      ? msds.chemical.incompatibilities.join("; ")
                      : "Tránh tiếp xúc nguồn nhiệt, ngọn lửa trần và các chất oxy hóa mạnh."}
                  </p>
                </div>
              </div>

              {msds.chemical.hazardCodes.length > 0 && (
                <div style={{ marginTop: "14px", background: "var(--surface)", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                  <strong style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>
                    Cảnh báo nguy hại GHS (Mã H)
                  </strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "12px", lineHeight: 1.5 }}>
                    {msds.chemical.hazardCodes.map((h, i) => (
                      <li key={i}>
                        <strong>{h.code}</strong>: {h.descriptionVi} <em>({h.descriptionEn})</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {msds.chemical.precautionaryCodes.length > 0 && (
                <div style={{ marginTop: "10px", background: "var(--surface)", padding: "10px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                  <strong style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>
                    Biện pháp phòng ngừa an toàn (Mã P)
                  </strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "12px", lineHeight: 1.5 }}>
                    {msds.chemical.precautionaryCodes.map((p, i) => (
                      <li key={i}>
                        <strong>{p.code}</strong>: {p.descriptionVi} <em>({p.descriptionEn})</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <h4 style={{ margin: "16px 0 8px", fontSize: "14px" }}>
              Điều hướng nhanh 16 Mục GHS Chuẩn (bấm để nhảy đến nội dung gốc):
            </h4>
            <div className="msds-sections-nav">
              {GHS_SECTIONS_DEF.map((sec) => {
                const item = msds.sections[sec.key];
                return (
                  <button
                    key={sec.key}
                    type="button"
                    className={`msds-section-pill ${item.found ? "found" : "missing"}`}
                    onClick={() => {
                      if (item.locator) jumpToLocator(item.locator);
                    }}
                    title={item.snippet || "Chưa phát hiện mục này"}
                  >
                    <div>
                      <strong>{sec.titleVi}</strong>
                      <small style={{ display: "block", color: "#64748b", fontSize: "10px" }}>{sec.titleEn}</small>
                    </div>
                    {item.found ? (
                      <span className="badge-ok">{item.locator || "Đã đọc"}</span>
                    ) : (
                      <span className="badge-none">Chưa rõ</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="source-preview-tools">
              <input
                aria-label="Tìm trong tài liệu"
                placeholder="Tìm CAS, thành phần, pH, mã sản phẩm…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Chọn trang, sheet hoặc phần"
                value={selected?.id || ""}
                onChange={(event) => setUnitId(event.target.value)}
              >
                {matches.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.locator}
                    {unit.method === "ocr" ? " · OCR" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="source-preview-body">
              {selected ? (
                <>
                  <div className="source-locator">
                    <strong>{selected.locator}</strong>
                    <span>
                      {selected.method === "ocr"
                        ? `OCR${selected.confidence !== undefined ? ` · ${Math.round(selected.confidence)}%` : ""} · Đối chiếu số và đơn vị với bản gốc`
                        : "Văn bản trích xuất trực tiếp"}
                    </span>
                    {document.format === "pdf" && (
                      <button className="text-button" onClick={() => setShowPage(!showPage)}>
                        {showPage ? "Ẩn trang PDF gốc" : "Đối chiếu trang PDF gốc"}
                      </button>
                    )}
                  </div>
                  <div className={showPage && document.format === "pdf" ? "source-compare" : ""}>
                    <pre>
                      {selected.text || "Không có chữ trích xuất được ở phần này. Kiểm tra bản gốc và lưu ý đọc tài liệu."}
                    </pre>
                    {showPage && document.format === "pdf" && (
                      <OriginalPdfPage
                        original={document.original}
                        pageNumber={Number(selected.locator.match(/Trang (\d+)/)?.[1] || 1)}
                      />
                    )}
                  </div>
                </>
              ) : (
                <p>Không có đoạn phù hợp từ khóa.</p>
              )}
            </div>
          </>
        )}

        <div className="document-footer">
          <span>Nội dung tài liệu là dữ liệu tham khảo; bố cục và hình vẽ xem trong bản gốc.</span>
          <button className="button secondary" onClick={() => download(false)}>
            <Download size={15} />Tải toàn bộ chữ đã đọc
          </button>
          <button className="button primary" onClick={() => download(true)}>
            <Download size={15} />Tải bản gốc
          </button>
        </div>
      </section>
    </div>
  );
}

function OriginalPdfPage({ original, pageNumber }: { original: Blob; pageNumber: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    void (async () => {
      setLoading(true);
      setError("");
      const pdfjs = await import("pdfjs-dist");
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = "/document-assets/pdf/pdf.worker.min.mjs";
      task = pdfjs.getDocument({
        data: new Uint8Array(await original.arrayBuffer()),
        cMapUrl: "/document-assets/pdf/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/document-assets/pdf/standard_fonts/",
        wasmUrl: "/document-assets/pdf/wasm/",
      });
      const pdf = await task.promise;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const target = canvas.current;
      if (cancelled || !target) return;
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      const context = target.getContext("2d");
      if (!context) throw new Error("Không tạo được ảnh trang PDF.");
      await page.render({ canvas: target, canvasContext: context, viewport }).promise;
    })()
      .catch(() => {
        if (!cancelled) setError("Không hiển thị được trang này. Hãy tải bản gốc để đối chiếu.");
      })
      .finally(() => {
        if (task) void task.destroy();
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (task) void task.destroy();
    };
  }, [original, pageNumber]);

  return (
    <div className="source-original-page">
      {loading && <p>Đang hiển thị trang {pageNumber}…</p>}
      {error && <p role="alert">{error}</p>}
      <canvas ref={canvas} aria-label={"Trang PDF gốc " + pageNumber} />
    </div>
  );
}
