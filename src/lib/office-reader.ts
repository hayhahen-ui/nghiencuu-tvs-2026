import { strFromU8, unzipSync } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { splitDocumentText, type DocumentUnit } from "./research-documents";

type ReadUnit = Omit<DocumentUnit, "id">;
export type OfficeExtraction = { units: ReadUnit[]; unitCount: number; warnings: string[]; images: { name: string; bytes: Uint8Array }[] };

export function officeArchive(bytes: Uint8Array) {
  let expanded = 0;
  return unzipSync(bytes, { filter(entry) {
    expanded += entry.originalSize;
    if (expanded > 80 * 1024 * 1024 || entry.originalSize > 32 * 1024 * 1024)
      throw new Error("Nội dung giải nén vượt 80 MB. Hãy chia nhỏ tài liệu.");
    return /^(word|xl)\//.test(entry.name) || entry.name === "[Content_Types].xml";
  } });
}

function xmlText(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Không hỗ trợ XML có khai báo thực thể hoặc DTD.");
  if (XMLValidator.validate(xml) !== true) throw new Error("XML trong file Word bị lỗi cấu trúc.");
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, removeNSPrefix: true, trimValues: false, parseTagValue: false });
  const walk = (nodes: Record<string, unknown>[]): string => nodes.map((node) => {
    if ("#text" in node) return String(node["#text"]);
    return Object.entries(node).filter(([tag]) => tag !== ":@").map(([tag, children]) => {
      if (["del", "instrText", "pPr", "rPr", "tblPr", "tcPr", "trPr"].includes(tag)) return "";
      if (tag === "tab") return "\t";
      if (tag === "br" || tag === "cr") return "\n";
      const content = Array.isArray(children) ? walk(children as Record<string, unknown>[]) : "";
      if (tag === "tc") return content.trim().replace(/\n+/g, " / ") + "\t";
      return content + (["p", "tr"].includes(tag) ? "\n" : "");
    }).join("");
  }).join("");
  return walk(parser.parse(xml)).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function readDocx(bytes: Uint8Array): OfficeExtraction {
  const archive = officeArchive(bytes);
  if (!archive["word/document.xml"]) throw new Error("File không phải DOCX hợp lệ hoặc đã được mã hóa.");
  const names = Object.keys(archive).filter((name) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(name))
    .sort((a, b) => a === "word/document.xml" ? -1 : b === "word/document.xml" ? 1 : a.localeCompare(b));
  const units: ReadUnit[] = [];
  const warnings: string[] = [];
  const labels: Record<string, string> = { document: "Nội dung và bảng", header: "Đầu trang", footer: "Chân trang", footnotes: "Chú thích chân trang", endnotes: "Chú thích cuối tài liệu", comments: "Bình luận" };
  for (const name of names) {
    const xml = strFromU8(archive[name]);
    const key = name.replace(/^word\//, "").replace(/\d*\.xml$/, "");
    units.push(...splitDocumentText(xmlText(xml), `${labels[key] || key} (${name.split("/").pop()})`));
    if (/<(?:\w+:)?del\b/.test(xml)) warnings.push("Có theo dõi sửa đổi: phần đã xóa được loại, phần chèn được giữ; đối chiếu bản Word khi cần lịch sử sửa đổi.");
    if (/<(?:\w+:)?altChunk\b/.test(xml)) warnings.push("Có đối tượng tài liệu nhúng altChunk chưa trích xuất; cần mở bản gốc hoặc xuất PDF.");
  }
  const images = Object.keys(archive).filter((name) => /^word\/media\//.test(name)).map((name) => ({ name, bytes: archive[name] }));
  if (images.length) warnings.push("Chữ trong ảnh được thử OCR; hình vẽ, biểu đồ và bố cục cần đối chiếu bản gốc.");
  return { units, unitCount: names.length, warnings: [...new Set(warnings)], images };
}

export async function readSpreadsheet(bytes: Uint8Array, format: "xlsx" | "xls" | "csv"): Promise<OfficeExtraction> {
  const XLSX = await import("xlsx");
  let archive: ReturnType<typeof officeArchive> | undefined;
  if (format === "xlsx") archive = officeArchive(bytes);
  let input: Uint8Array | string = bytes;
  if (format === "csv") {
    try { input = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new Error("CSV không phải UTF-8. Hãy lưu lại CSV UTF-8 từ Excel để giữ đúng tiếng Việt."); }
  }
  const book = XLSX.read(input, { type: format === "csv" ? "string" : "array", cellFormula: true, cellText: true, cellDates: true, cellNF: true, bookVBA: false, cellHTML: false });
  if (!book.SheetNames.length || book.SheetNames.length > 100) throw new Error("Workbook không có sheet hoặc vượt 100 sheet.");
  const units: ReadUnit[] = [];
  const warnings: string[] = [];
  let cellCount = 0, hasFormula = false;
  for (const [index, name] of book.SheetNames.entries()) {
    const sheet = book.Sheets[name];
    const hidden = book.Workbook?.Sheets?.[index]?.Hidden;
    const cells = Object.keys(sheet).filter((address) => /^[A-Z]+[1-9][0-9]*$/.test(address)).map((address) => ({ address, ...XLSX.utils.decode_cell(address) }))
      .sort((a, b) => a.r - b.r || a.c - b.c);
    cellCount += cells.length;
    if (cellCount > 200000) throw new Error("Workbook vượt 200.000 ô có dữ liệu. Hãy chia nhỏ; không có ô nào bị cắt âm thầm.");
    let text = `Sheet: ${name}${hidden ? " (sheet ẩn, vẫn được đọc)" : ""}\n`;
    let firstRow = 1, lastRow = 1;
    const flush = () => {
      units.push(...splitDocumentText(text, `Sheet “${name}” · hàng ${firstRow}–${lastRow}`));
      text = "";
    };
    for (const [i, cell] of cells.entries()) {
      const value = sheet[cell.address];
      if (!i) firstRow = cell.r + 1;
      lastRow = cell.r + 1;
      const display = value.w ?? (value.v instanceof Date ? value.v.toISOString() : String(value.v ?? ""));
      const formula = value.f ? ` [công thức: =${value.f}; ${value.v === undefined ? "chưa có kết quả lưu" : "kết quả lưu, chưa tính lại"}]` : "";
      hasFormula ||= Boolean(value.f);
      const comments = value.c?.map((comment: { t?: string }) => comment.t).filter(Boolean).join("; ");
      text += `${cell.address}: ${display}${formula}${comments ? ` [ghi chú: ${comments}]` : ""}\n`;
      if (text.length > 4800) { flush(); firstRow = cell.r + 1; }
    }
    if (sheet["!merges"]?.length) text += "Ô gộp: " + sheet["!merges"].map((range) => XLSX.utils.encode_range(range)).join(", ") + "\n";
    if (text.trim()) flush();
  }
  if (hasFormula) warnings.push("Đọc công thức và kết quả được lưu trong file; ứng dụng không tính lại công thức hoặc mở liên kết ngoài.");
  const images = archive ? Object.keys(archive).filter((name) => /^xl\/media\//.test(name)).map((name) => ({ name, bytes: archive![name] })) : [];
  if (images.length || format === "xls") warnings.push("Biểu đồ, hình vẽ và đối tượng nhúng cần đối chiếu bản Excel; OCR ảnh không diễn giải đồ thị.");
  return { units, unitCount: book.SheetNames.length, warnings, images };
}
