import { completeDocument, MAX_DOCUMENT_BYTES, MAX_DOCUMENT_CHARS, splitDocumentText, type DocumentFormat, type DocumentUnit, type ResearchDocument } from "./research-documents";
import type { Worker as OcrWorker } from "tesseract.js";

export type ReadOptions = { ocrAllPages?: boolean; signal?: AbortSignal; onProgress?: (message: string) => void };
type PdfTextItem = { str: string; transform: number[]; width: number; height: number };

export function pdfTextLines(items: PdfTextItem[]) {
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of [...items].filter((i) => i.str?.trim()).sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
    const row = rows.find((r) => Math.abs(r.y - item.transform[5]) < 2.5);
    if (row) row.items.push(item); else rows.push({ y: item.transform[5], items: [item] });
  }
  return rows.map((row) => {
    let right = -Infinity;
    return row.items.sort((a, b) => a.transform[4] - b.transform[4]).map((item, i) => {
      const gap = item.transform[4] - right;
      right = item.transform[4] + item.width;
      return (i ? gap > 8 ? "\t" : " " : "") + item.str;
    }).join("");
  }).join("\n");
}

function checkAbort(options: ReadOptions) { options.signal?.throwIfAborted(); }

export async function readResearchFile(file: File, options: ReadOptions = {}): Promise<ResearchDocument> {
  if (!file.size || file.size > MAX_DOCUMENT_BYTES) throw new Error("Mỗi file cần có dữ liệu và không vượt 30 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() as DocumentFormat;
  if (!["pdf", "docx", "doc", "xlsx", "xls", "csv"].includes(extension))
    throw new Error("Hỗ trợ PDF, Word DOC/DOCX, Excel XLS/XLSX và CSV.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const id = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const units: Omit<DocumentUnit, "id">[] = [];
  const warnings: string[] = [];
  let unitCount = 0, processedCount = 0, ocr: OcrWorker | undefined;
  const stopOcr = () => { if (ocr) void ocr.terminate().catch(() => {}); };
  options.signal?.addEventListener("abort", stopOcr, { once: true });
  const recognize = async (image: HTMLCanvasElement | Blob) => {
    checkAbort(options);
    if (!ocr) {
      options.onProgress?.("Khởi tạo OCR tiếng Việt và tiếng Anh…");
      const { createWorker } = await import("tesseract.js");
      ocr = await createWorker("vie+eng", 1, {
        workerPath: "/document-assets/ocr/worker.min.js", workerBlobURL: false,
        langPath: "/document-assets/ocr/lang", corePath: "/document-assets/ocr/core",
        logger: (message) => { if (message.status === "recognizing text") options.onProgress?.(`OCR ${Math.round(message.progress * 100)}%…`); },
      });
      checkAbort(options);
      await ocr.setParameters({ preserve_interword_spaces: "1" });
    }
    const result = await ocr.recognize(image, { rotateAuto: true });
    checkAbort(options);
    return result.data;
  };
  const append = (parts: Omit<DocumentUnit, "id">[]) => {
    units.push(...parts);
    if (units.length > 3000 || units.reduce((n, u) => n + u.text.length, 0) > MAX_DOCUMENT_CHARS)
      throw new Error("Tài liệu vượt 2 triệu ký tự hoặc 3.000 đoạn. Hãy chia nhỏ file.");
  };
  try {
    checkAbort(options);
    if (extension === "pdf") {
      if (!new TextDecoder("latin1").decode(bytes.slice(0, 1024)).includes("%PDF-")) throw new Error("File không có định dạng PDF hợp lệ.");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/document-assets/pdf/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({
        data: bytes, stopAtErrors: true,
        cMapUrl: "/document-assets/pdf/cmaps/", cMapPacked: true,
        standardFontDataUrl: "/document-assets/pdf/standard_fonts/", wasmUrl: "/document-assets/pdf/wasm/",
      });
      const cancelPdf = () => { void task.destroy(); };
      options.signal?.addEventListener("abort", cancelPdf, { once: true });
      try {
        const pdf = await task.promise;
        unitCount = pdf.numPages;
        if (unitCount > 200) throw new Error("PDF vượt 200 trang. Hãy chia thành các tài liệu nhỏ hơn.");
        for (let number = 1; number <= unitCount; number++) {
          checkAbort(options);
          options.onProgress?.(`Đọc trang ${number}/${unitCount}…`);
          let fallbackText = "";
          try {
            const page = await pdf.getPage(number);
            const content = await page.getTextContent();
            let text = pdfTextLines(content.items.filter((item): item is typeof item & PdfTextItem => "str" in item));
            const annotations = await page.getAnnotations();
            const fields = annotations.map((a) => a.fieldValue ? `${a.fieldName || "Trường biểu mẫu"}: ${String(a.fieldValue)}` : "").filter(Boolean);
            if (fields.length) text += "\n" + fields.join("\n");
            fallbackText = text;
            const needOcr = options.ocrAllPages || text.replace(/\s/g, "").length < 80 || (text.match(/�/g)?.length || 0) > text.length * .08;
            if (needOcr) {
              const viewport = page.getViewport({ scale: 2.2 });
              const scale = Math.min(1, Math.sqrt(12_000_000 / (viewport.width * viewport.height)));
              const renderViewport = page.getViewport({ scale: 2.2 * scale });
              const canvas = document.createElement("canvas");
              canvas.width = Math.ceil(renderViewport.width); canvas.height = Math.ceil(renderViewport.height);
              try {
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Không tạo được vùng đọc ảnh.");
                await page.render({ canvas, canvasContext: context, viewport: renderViewport }).promise;
                options.onProgress?.(`OCR trang ${number}/${unitCount}…`);
                const result = await recognize(canvas);
                if (result.text.trim()) {
                  append(splitDocumentText((text.trim() ? `Lớp chữ PDF:\n${text}\n\nOCR toàn trang:\n` : "") + result.text, `Trang ${number}`, "ocr", result.confidence));
                  if (result.confidence < 70) warnings.push(`Trang ${number}: OCR độ tin cậy thấp (${Math.round(result.confidence)}%); kiểm tra CAS, nồng độ, dấu thập phân và đơn vị trên bản gốc.`);
                } else {
                  append(splitDocumentText(text, `Trang ${number}`));
                  warnings.push(`Trang ${number}: OCR không nhận được chữ; có thể là trang trống hoặc chỉ có hình.`);
                }
              } finally { canvas.width = 0; canvas.height = 0; }
            } else append(splitDocumentText(text, `Trang ${number}`));
            processedCount++;
            page.cleanup();
          } catch (error) {
            checkAbort(options);
            const message = error instanceof Error ? error.message : "Lỗi đọc trang";
            if (/vượt 2 triệu/.test(message)) throw error;
            warnings.push(`Trang ${number} chưa đọc đầy đủ: ${message.slice(0, 200)}${fallbackText.trim() ? "; đã giữ lại lớp chữ PDF" : ""}`);
            append(splitDocumentText(fallbackText, `Trang ${number}${fallbackText.trim() ? " (chưa OCR được phần ảnh)" : " (chưa đọc được)"}`));
          }
        }
        warnings.push("Hình vẽ, cấu trúc hóa học, ký hiệu nguy hại và bố cục bảng cần đối chiếu PDF gốc. Có thể chọn OCR toàn bộ khi chữ nằm trong ảnh xen kẽ.");
        if (await pdf.getAttachments()) warnings.push("PDF có tệp đính kèm bên trong chưa được nạp; hãy tải và nhập chúng riêng nếu cần.");
      } finally {
        options.signal?.removeEventListener("abort", cancelPdf);
        await task.destroy();
      }
    } else if (extension === "doc") {
      if (file.size > 3_500_000) throw new Error("DOC cũ vượt 3,5 MB: lưu lại thành DOCX rồi nhập; PDF/DOCX/Excel hỗ trợ 30 MB.");
      options.onProgress?.("Đọc Word DOC trên máy chủ ứng dụng…");
      const response = await fetch("/api/documents/legacy-word", { method: "POST", headers: { "Content-Type": "application/msword" }, body: file, signal: options.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không đọc được DOC.");
      append(result.units); unitCount = result.unitCount; processedCount = result.unitCount;
      warnings.push(...result.warnings);
    } else {
      const reader = await import("./office-reader");
      options.onProgress?.(extension === "docx" ? "Đọc nội dung, bảng, chú thích và đầu/chân trang…" : "Đọc toàn bộ sheet, ô dữ liệu và công thức…");
      const result = extension === "docx" ? reader.readDocx(bytes) : await reader.readSpreadsheet(bytes, extension);
      append(result.units); unitCount = result.unitCount; processedCount = result.unitCount;
      warnings.push(...result.warnings);
      if (result.images.length > 50) throw new Error("Tài liệu có hơn 50 ảnh nhúng; hãy chia nhỏ hoặc xuất PDF.");
      unitCount += result.images.length;
      for (const image of result.images) {
        checkAbort(options);
        options.onProgress?.(`OCR ảnh ${image.name}…`);
        try {
          const data = await recognize(new Blob([image.bytes.slice().buffer]));
          append(splitDocumentText(data.text, `Ảnh nhúng ${image.name}`, "ocr", data.confidence));
          processedCount++;
          if (data.confidence < 70) warnings.push(`Ảnh ${image.name}: OCR cần kiểm tra lại số liệu (${Math.round(data.confidence)}%).`);
        } catch (error) {
          checkAbort(options);
          warnings.push(`Chưa đọc được ảnh ${image.name}; xem ảnh trong bản gốc.`);
          append(splitDocumentText("", `Ảnh ${image.name} (chưa đọc được)`));
        }
      }
    }
    checkAbort(options);
    if (processedCount < unitCount) warnings.unshift(`Chỉ xử lý thành công ${processedCount}/${unitCount} trang/phần; cần kiểm tra những phần chưa đọc được trên bản gốc.`);
    return completeDocument({ id, name: file.name.slice(0, 300), format: extension, size: file.size, importedAt: new Date().toISOString(), unitCount, processedCount, units, warnings: [...new Set(warnings)].slice(0, 100) });
  } catch (error) {
    if (error instanceof Error && /Password|password/i.test(error.message)) throw new Error("Tài liệu được bảo vệ bằng mật khẩu. Hãy mở khóa một bản sao rồi nhập lại.");
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", stopOcr);
    if (ocr) await ocr.terminate().catch(() => {});
  }
}
