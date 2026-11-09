import { generateScientificPrintableHtml, generateScientificWordDocument } from "../src/lib/scientific-export";
import type { ChatSession } from "../src/lib/chat-history-store";

async function main() {
  const sample: ChatSession = {
    id: "session-scientific-2026",
    title: "Nghiên cứu tỷ lệ dung môi tẩy rửa công đoạn phun",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    model: "deepseek-v4.1-flash",
    language: "vi",
    documentNames: ["MSDS_Chat_Tay_Rua_297.pdf", "SDS_Dung_Moi_289.docx"],
    messages: [
      {
        role: "user",
        content: "Đề xuất dùng 297 100% không pha thêm 289 và 299A.",
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: "## Đánh giá an toàn\n\nTheo SDS của chất 297, cần thông gió chống cháy nổ.\n\n### Khuyến cáo:\n- Bắt buộc dùng kính bảo hộ và găng tay Nitrile.",
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const html = generateScientificPrintableHtml(sample);
  console.log("HTML length:", html.length);
  console.log("Contains Republic header:", html.includes("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"));
  console.log("Contains Signatures:", html.includes("TRƯỞNG PHÒNG R&D / LAB LEAD"));

  const blob = await generateScientificWordDocument(sample);
  console.log("Word Blob generated successfully! Size:", blob.size, "bytes");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
