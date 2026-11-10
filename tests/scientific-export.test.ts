import test from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import {
  generateScientificPrintableHtml,
  generateScientificWordDocument,
} from "../src/lib/scientific-export";
import {
  cleanAssistantText,
  groupDialogueExchanges,
  normalizeReportTitle,
  parseMarkdownBlocks,
  unwrapJsonWrappedContent,
} from "../src/lib/report-formatter";
import type { ChatSession } from "../src/lib/chat-history-store";

test("scientific-export: generates standard A4 HTML with academic headers and signatures", () => {
  const sample: ChatSession = {
    id: "session-test-export",
    title: "Khảo sát tính tương thích hóa học",
    createdAt: "2026-10-21T08:00:00Z",
    updatedAt: "2026-10-21T08:30:00Z",
    model: "deepseek-v4.1-flash",
    language: "vi",
    documentNames: ["MSDS_Solvent_A.pdf", "GHS_Guide.docx"],
    messages: [
      {
        role: "user",
        content: "Hỏi về giới hạn tiếp xúc nghề nghiệp (OEL) của MEK.",
        timestamp: "2026-10-21T08:05:00Z",
      },
      {
        role: "assistant",
        content: "Theo QCVN 03:2019/BYT và SDS: TWA = 200 ppm, STEL = 300 ppm.",
        timestamp: "2026-10-21T08:06:00Z",
      },
    ],
  };

  const html = generateScientificPrintableHtml(sample);
  assert.ok(html.includes("BÁO CÁO KẾT QUẢ ĐỐI THOẠI &amp; PHÂN TÍCH KHOA HỌC"));
  assert.ok(html.includes("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"));
  assert.ok(html.includes("session-test-export"));
  assert.ok(html.includes("deepseek-v4.1-flash"));
  assert.ok(html.includes("MSDS_Solvent_A.pdf"));
  assert.ok(html.includes("Bảng 1. Danh mục tài liệu khoa học"));
  assert.ok(html.includes("TÓM TẮT ĐIỀU HÀNH &amp; KẾT LUẬN CHÍNH"));
  assert.ok(html.includes("TRƯỞNG PHÒNG R&amp;D / LAB LEAD"));
  assert.ok(html.includes("CHUYÊN VIÊN THẨM ĐỊNH"));
  assert.ok(html.includes("NGƯỜI LẬP BÁO CÁO"));
});

test("scientific-export: unwraps JSON responses, strips fallback banners, deduplicates failed retries, and renders Markdown tables cleanly into DOCX & HTML", async () => {
  const legacyWrappedAnswer =
    '💡 **Thông báo chuyển đổi mô hình (Experiential Labs):**\n' +
    'Mô hình bạn chọn ban đầu (`claude-fable-5.2`) báo lỗi hoặc quá thời gian chờ (timeout). Hệ thống đã tự động hoàn thành câu trả lời bằng mô hình: **`gpt-4.1-mini`** (Experiential Cloud).\n' +
    '---\n' +
    JSON.stringify({
      content:
        "## 1. Tóm tắt & Kết luận Thẩm định\n" +
        "- **Kết luận:** Khả thi có điều kiện — bắt buộc thử nghiệm Pilot trước khi sản xuất.\n\n" +
        "## 2. Bảng đối chiếu thông số SDS\n" +
        "| Sản phẩm | Thành phần chính | Điểm chớp cháy |\n" +
        "| --- | --- | --- |\n" +
        "| 297 | Methylcyclohexane, n-Hexane [124.297-SDS.pdf, Trang 3](#source/0123456789abcdef0123456789abcdef/u3) | −6 °C |\n" +
        "| 289 | MEK 80–99% | −6 °C |",
    });

  assert.equal(
    unwrapJsonWrappedContent('```json\n{"content": "Kết quả sạch"}\n```'),
    "Kết quả sạch",
  );
  assert.ok(!cleanAssistantText(legacyWrappedAnswer).includes('"content"'));
  assert.ok(!cleanAssistantText(legacyWrappedAnswer).includes("Thông báo chuyển đổi mô hình"));

  const session: ChatSession = {
    id: "session-1794207915616",
    title: "hãy phân tích tính khả khi của nhận định sau đề xuất thay đổi công thức chất vệ sinh trước công đoạn phun",
    createdAt: "2026-11-09T07:10:34.000Z",
    updatedAt: "2026-11-10T07:36:49.000Z",
    model: "claude-fable-5.2",
    language: "vi",
    documentNames: ["124.297-SDS.pdf", "111.289-SDS.pdf"],
    messages: [
      { role: "user", content: "hãy trả lời bằng tiếng việt", timestamp: "2026-11-09T07:13:19Z" },
      { role: "user", content: "Đề xuất thay đổi tỷ lệ pha: dùng 297 100%, bỏ 289 và 299A.", timestamp: "2026-11-09T08:40:59Z" },
      { role: "user", content: "Đề xuất thay đổi tỷ lệ pha: dùng 297 100%, bỏ 289 và 299A.", timestamp: "2026-11-09T08:41:57Z" },
      { role: "assistant", content: legacyWrappedAnswer, timestamp: "2026-11-10T07:36:49Z" },
    ],
  };

  assert.equal(normalizeReportTitle(session.title).startsWith("Đề xuất thay đổi"), true);

  const exchanges = groupDialogueExchanges(session.messages);
  assert.equal(exchanges.length, 2);
  assert.equal(exchanges[1].skippedDuplicateRetries, 1);
  assert.equal(exchanges[1].modelUsed, "gpt-4.1-mini");
  assert.equal(exchanges[1].requestedModel, "claude-fable-5.2");

  const blocks = parseMarkdownBlocks(exchanges[1].assistantContent || "");
  assert.ok(blocks.some((b) => b.type === "table" && b.rows.length === 2));

  const html = generateScientificPrintableHtml(session);
  assert.ok(html.includes('<table class="md-table">'));
  assert.ok(html.includes("[124.297-SDS.pdf, Trang 3]"));
  assert.ok(!html.includes("#source/0123456789abcdef"));
  assert.ok(!html.includes('{"content"'));
  assert.ok(!html.includes("Thông báo chuyển đổi mô hình"));
  assert.ok(!html.includes("hãy trả lời bằng tiếng việt")); // orphan short retry skipped

  const blob = await generateScientificWordDocument(session);
  assert.ok(blob instanceof Blob);
  assert.ok(blob.size > 5000);
  const unzipped = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const docXml = strFromU8(unzipped["word/document.xml"]);
  assert.ok(docXml.includes("Methylcyclohexane, n-Hexane"));
  assert.ok(docXml.includes("[124.297-SDS.pdf, Trang 3]"));
  assert.ok(!docXml.includes("#source/0123456789abcdef"));
  assert.ok(!docXml.includes("Thông báo chuyển đổi mô hình"));
});
