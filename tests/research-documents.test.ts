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
test("selectDocumentEvidence and createChatSchema sanitize OCR confidence, long metadata, and long replies", () => {
  const dirtyOcrDoc: ResearchDocument = {
    id: "a".repeat(32),
    name: "Signed-MSDS-".repeat(40) + ".pdf",
    format: "pdf",
    size: 5000,
    importedAt: "2026-11-10T00:00:00.000Z",
    unitCount: 2,
    processedCount: 2,
    warnings: ["W".repeat(700)],
    units: [
      { id: "u1", locator: "Trang 1 " + "x".repeat(350), text: "CAS 7631-86-9 nội dung OCR", method: "ocr", confidence: -1 },
      { id: "u2", locator: "Trang 2", text: "Thành phần 100%", method: "ocr", confidence: Number.NaN },
    ],
  };
  const selected = selectDocumentEvidence([dirtyOcrDoc], "CAS 7631-86-9");
  assert.equal(evidenceSchema.safeParse(selected).success, true);
  assert.equal(selected[0].units[0].confidence, 0);
  assert.equal(selected[0].units[1].confidence, undefined);
  assert.equal(
    evidenceSchema.safeParse(JSON.parse(JSON.stringify([{ ...selected[0], units: [{ ...selected[0].units[0], confidence: null }] }]))).success,
    true,
  );
  const longAssistantReply = "Báo cáo phân tích chi tiết ".repeat(650); // > 12,000 chars
  assert.equal(
    createChatSchema([]).safeParse({
      messages: [
        { role: "user", content: "Phân tích SDS" },
        { role: "assistant", content: longAssistantReply },
        { role: "user", content: "Tóm tắt PPE" },
      ],
      documents: selected,
    }).success,
    true,
  );
});

test("evidenceSchema validates medical image formats and handles diagnostic scan evidence", () => {
  for (const fmt of ["jpg", "jpeg", "png", "webp", "bmp"] as const) {
    const doc = {
      id: "b".repeat(32),
      name: `Sieu_Am_Bung_${fmt}.${fmt}`,
      format: fmt,
      totalUnits: 1,
      warnings: [],
      units: [
        {
          id: "u1",
          locator: "Ảnh chẩn đoán",
          text: "KẾT QUẢ SIÊU ÂM\nBệnh nhân: CAO VĂN HỒNG\nNang gan phải kt 14.3 x 13.6 mm\nHemangioma gan phải kt 18.3 x 13.4 mm",
          method: "ocr" as const,
          confidence: 88,
        },
      ],
    };
    const parsed = evidenceSchema.safeParse([doc]);
    assert.equal(parsed.success, true, `Format ${fmt} should be valid`);
  }
});

test("analyzeMedicalReport extracts organs, measurements, conclusions and research recommendations from ultrasound OCR", async () => {
  const { analyzeMedicalReport } = await import("../src/lib/medical-analyzer");
  const ultrasoundDoc: ResearchDocument = {
    id: "c".repeat(32),
    name: "Ket_Qua_Sieu_Am_Sai_Gon_Medic.jpg",
    format: "jpg",
    size: 250000,
    importedAt: "2026-11-16T09:00:00.000Z",
    unitCount: 1,
    processedCount: 1,
    warnings: [],
    units: [
      {
        id: "u1",
        locator: "Ảnh chẩn đoán",
        text: `PHÒNG KHÁM ĐA KHOA SÀI GÒN MEDIC-TN
KẾT QUẢ SIÊU ÂM
Họ tên: CAO VĂN HỒNG   Năm sinh: 1963   Giới tính: Nam
Vùng Siêu Âm: Siêu âm Ổ Bụng (gan Mật, Tụy, Lách, Thận, Bàng Quang)
- Gan: Gan phải có 01 cấu trúc echo trống, kt # 14.3 x 13.6 mm, trục ngang, bờ đều.
Gan phải có 1 cấu trúc echo dày, bờ đều, không tăng sinh mạch máu bên trong và xung quanh, kt max # 18.3 x 13.4 mm.
- Mật: Đường mật trong gan và ngoài gan không dãn. Túi mật: Không to, thành mỏng, không sỏi.
- Tụy: Cấu trúc đồng nhất, không u, ống Wirsung không dãn.
- Lách: Kích thước bình thường.
- Thận: P: Không ứ nước, không có sỏi. T: Có cấu trúc echo dày có bóng lưng d=8 mm, không ứ nước.
- Bàng quang: Thành không dày, không sỏi.
- Tiền liệt tuyến: Không to, cấu trúc đồng nhất, có nốt vôi hóa, kt # 13 mm. Thể tích 37.11 gram.
- Dạ dày chướng hơi.
KẾT LUẬN:
- NANG GAN PHẢI
- HEMANGIOMA GAN PHẢI
- NỐT VÔI HÓA TIỀN LIỆT TUYẾN
- DẠ DÀY CHƯỚNG HƠI
BS. TRẦN VĂN HỢP`,
        method: "ocr",
        confidence: 85,
      },
    ],
  };

  const analysis = analyzeMedicalReport(ultrasoundDoc);
  assert.equal(analysis.isMedicalReport, true);
  assert.equal(analysis.reportType, "ultrasound");
  assert.equal(analysis.patient.fullName, "CAO VĂN HỒNG");
  assert.equal(analysis.patient.birthYear, "1963");
  assert.equal(analysis.patient.gender, "Nam");
  assert.ok(analysis.patient.facilityName?.includes("SÀI GÒN MEDIC"));
  assert.ok(analysis.patient.doctorName?.includes("TRẦN VĂN HỢP"));

  // Conclusions
  assert.ok(analysis.conclusions.some((c) => c.includes("NANG GAN")));
  assert.ok(analysis.conclusions.some((c) => c.includes("HEMANGIOMA")));
  assert.ok(analysis.conclusions.some((c) => c.includes("TIỀN LIỆT TUYẾN")));

  // Research Recommendations
  assert.ok(analysis.researchRecommendations.some((r) => r.includes("Nang gan đơn thuần")));
  assert.ok(analysis.researchRecommendations.some((r) => r.includes("U máu gan")));
  assert.ok(analysis.researchRecommendations.some((r) => /tiền liệt/i.test(r)));

  // Context summary injection
  const evidence = selectDocumentEvidence([ultrasoundDoc], "siêu âm");
  const context = documentEvidenceContext(evidence);
  assert.ok(context.text.includes("[DỮ LIỆU CHẨN ĐOÁN HÌNH ẢNH Y TẾ & KẾT QUẢ CẬN LÂM SÀNG ĐÃ TRÍCH XUẤT CHO NGHIÊN CỨU]"));
  assert.ok(context.text.includes("CAO VĂN HỒNG"));
});
