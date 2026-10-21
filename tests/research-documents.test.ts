import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { readDocx, readSpreadsheet } from "../src/lib/office-reader";
import { completeDocument, documentEvidenceContext, evidenceSchema, selectDocumentEvidence, splitDocumentText, type ResearchDocument } from "../src/lib/research-documents";
import { createChatSchema } from "../src/lib/chat-context";
import { pdfTextLines } from "../src/lib/document-reader";

const xml = (body: string) => `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
test("DOCX reads ordered body, tables, headers, footers, footnotes and comments across templates", () => {
  const bytes = zipSync({
    "word/document.xml": strToU8(xml(paragraph("MSDS mẫu công ty A") + `<w:tbl><w:tr><w:tc>${paragraph("CAS")}</w:tc><w:tc>${paragraph("7631-86-9")}</w:tc></w:tr></w:tbl>` + paragraph("Mục cuối cùng 16"))),
    "word/header1.xml": strToU8(xml(paragraph("Đầu trang"))), "word/footer1.xml": strToU8(xml(paragraph("Chân trang"))),
    "word/footnotes.xml": strToU8(xml(paragraph("Chú thích an toàn"))), "word/comments.xml": strToU8(xml(paragraph("Bình luận nhà cung cấp"))),
  });
  const result = readDocx(bytes);
  assert.equal(result.unitCount, 5);
  const text = result.units.map((unit) => unit.text).join("\n");
  for (const expected of ["MSDS mẫu công ty A", "CAS\t7631-86-9", "Mục cuối cùng 16", "Đầu trang", "Chân trang", "Chú thích an toàn", "Bình luận nhà cung cấp"]) assert.ok(text.includes(expected), expected);
  assert.throws(() => readDocx(zipSync({ "word/document.xml": strToU8('<!DOCTYPE doc [<!ENTITY x "secret">]><doc/>') })), /DTD/);
  assert.throws(() => readDocx(zipSync({ "word/document.xml": strToU8("<unclosed>") })), /cấu trúc/);
});

test("Spreadsheet reader includes every sheet, hidden data, zero values, formulas and late rows", async () => {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Sản phẩm", "Nồng độ"], ["Silica", 0], ["Hóa chất", .25]]);
  sheet.C3 = { t: "n", f: "B2+B3", v: .25 }; sheet["!ref"] = "A1:C300";
  sheet.A300 = { t: "s", v: "Hàng cuối có căn cứ" };
  XLSX.utils.book_append_sheet(book, sheet, "Thành phần");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Sheet ẩn vẫn cần đọc"]]), "Nguồn ẩn");
  book.Workbook = { Sheets: [{ name: "Thành phần", Hidden: 0 }, { name: "Nguồn ẩn", Hidden: 1 }] };
  const result = await readSpreadsheet(new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" })), "xlsx");
  assert.equal(result.unitCount, 2);
  const text = result.units.map((unit) => unit.text).join("\n");
  for (const expected of ["B2: 0", "B2+B3", "A300: Hàng cuối có căn cứ", "Sheet ẩn vẫn cần đọc", "sheet ẩn, vẫn được đọc"]) assert.ok(text.includes(expected), expected);
  assert.ok(result.warnings.some((warning) => warning.includes("không tính lại")));
  const csv = await readSpreadsheet(strToU8("Tên,CAS\nSilica,7631-86-9\nHóa chất,0"), "csv");
  assert.ok(csv.units.map((unit) => unit.text).join().includes("Hóa chất"));
});

function document(index: number, count: number, textSize: number): ResearchDocument {
  return completeDocument({ id: index.toString(16).padStart(32, "0"), name: `MSDS-${index}.pdf`, format: "pdf", size: 1000, importedAt: "2026-10-21", unitCount: count, processedCount: count, warnings: [], units: Array.from({ length: count }, (_, i) => ({ locator: `Trang ${i + 1}`, text: `Nội dung ${i} ` + "a".repeat(textSize), method: "text" as const })) });
}
test("All 42 pages of typical SDS sources fit without silent omissions and have stable citations", () => {
  const docs = [document(1, 10, 2000), document(2, 11, 2000), document(3, 10, 2000), document(4, 11, 2000)];
  const selected = selectDocumentEvidence(docs, "So sánh SDS");
  assert.equal(selected.reduce((n, doc) => n + doc.units.length, 0), 42);
  assert.equal(evidenceSchema.safeParse(selected).success, true);
  const context = documentEvidenceContext(selected);
  assert.equal(context.info.includedUnits, 42);
  assert.equal(context.info.totalUnits, 42);
  assert.ok(context.text.includes(`#source/${docs[3].id}/u11`));
  assert.equal(createChatSchema([]).parse({ messages: [{ role: "user", content: "Đọc tài liệu" }], documents: selected }).documents.length, 4);
});
test("Large sources keep full local text, include late relevant evidence and allocate space to every selected file", () => {
  const docs = Array.from({ length: 10 }, (_, i) => document(i + 1, 5, 5000));
  docs[0].units[4].text = "CAS 7631-86-9 thông số ở trang cuối" + "b".repeat(4000);
  const selected = selectDocumentEvidence(docs, "CAS 7631-86-9");
  assert.equal(selected.length, 10);
  assert.ok(selected[0].units.some((unit) => unit.id === "u5"));
  assert.ok(selected.reduce((n, doc) => n + doc.units.reduce((m, unit) => m + unit.text.length, 0), 0) <= 120000);
  assert.equal(docs.reduce((n, doc) => n + doc.units.length, 0), 50);
  assert.equal(evidenceSchema.safeParse([...selected, selected[0]]).success, false);
  assert.equal(evidenceSchema.safeParse([{ ...selected[0], units: [...selected[0].units, selected[0].units[0]] }]).success, false);
});
test("Text chunking preserves every character and rejects unreadable or excessive documents", () => {
  const text = "Hóa chất và nồng độ 1.25%\n".repeat(800);
  const parts = splitDocumentText(text, "Trang 1");
  assert.equal(parts.map((part) => part.text).join(""), text.trim());
  assert.ok(parts.every((part) => part.text.length <= 6000));
  assert.throws(() => completeDocument({ ...document(1, 1, 1), units: [{ locator: "Trang 1", text: "", method: "text" }] }), /Không trích được chữ/);
});
test("PDF table text preserves row order and column boundaries", () => {
  const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y], width: 40, height: 10 });
  assert.equal(pdfTextLines([item("7631-86-9", 120, 100), item("Kết thúc", 10, 60), item("CAS", 10, 100)]), "CAS\t7631-86-9\nKết thúc");
});
