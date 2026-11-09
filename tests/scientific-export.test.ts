import test from "node:test";
import assert from "node:assert/strict";
import {
  generateScientificPrintableHtml,
  generateScientificWordDocument,
} from "../src/lib/scientific-export";
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
  assert.ok(html.includes("BÁO CÁO KẾT QUẢ ĐỐI THOẠI & PHÂN TÍCH KHOA HỌC"));
  assert.ok(html.includes("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"));
  assert.ok(html.includes("session-test-export"));
  assert.ok(html.includes("deepseek-v4.1-flash"));
  assert.ok(html.includes("MSDS_Solvent_A.pdf"));
  assert.ok(html.includes("TRƯỞNG PHÒNG R&D / LAB LEAD"));
  assert.ok(html.includes("CHUYÊN VIÊN THẨM ĐỊNH"));
  assert.ok(html.includes("NGƯỜI LẬP BÁO CÁO"));
});

test("scientific-export: generates valid Word (.docx) binary blob", async () => {
  const sample: ChatSession = {
    id: "session-test-docx",
    title: "Đánh giá an toàn phòng nổ",
    createdAt: "2026-10-21T09:00:00Z",
    updatedAt: "2026-10-21T09:15:00Z",
    model: "deepseek-v4.1-flash",
    language: "vi",
    documentNames: ["Chemical_Safety.pdf"],
    messages: [
      { role: "user", content: "Nêu quy định tiếp địa chống tĩnh điện." },
      { role: "assistant", content: "Điện trở tiếp địa phải nhỏ hơn 10 Ohm theo tiêu chuẩn." },
    ],
  };

  const blob = await generateScientificWordDocument(sample);
  assert.ok(blob instanceof Blob);
  assert.ok(blob.size > 5000);
});
