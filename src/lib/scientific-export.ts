/**
 * Scientific Research Export Module
 * Chuẩn xuất báo cáo nghiên cứu khoa học cho Hội thoại (Word .docx & PDF)
 * Tuân thủ quy chuẩn văn bản khoa học, bảng tra cứu bằng chứng, và khối chữ ký phê duyệt.
 */

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  HeadingLevel,
  Packer,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
import type { ChatSession, ChatMessageItem } from "./chat-history-store";

const FONT_FAMILY = "Times New Roman";
const PRIMARY_COLOR = "1e3a8a"; // Navy blue
const TEXT_COLOR = "1f2937"; // Slate dark
const BORDER_COLOR = "cbd5e1"; // Slate light

/**
 * Tạo tài liệu Word (.docx) chuẩn báo cáo nghiên cứu khoa học từ phiên hội thoại
 */
export async function generateScientificWordDocument(session: ChatSession): Promise<Blob> {
  const dateStr = new Date(session.updatedAt || session.createdAt).toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date(session.updatedAt || session.createdAt).toLocaleTimeString("vi-VN");

  // Khối Header Quốc hiệu & Đơn vị nghiên cứu
  const topHeaderTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "HỆ THỐNG TRỢ LÝ NGHIÊN CỨU KHOA HỌC",
                    bold: true,
                    size: 19,
                    font: FONT_FAMILY,
                    color: PRIMARY_COLOR,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "RESEARCH AGENT PLATFORM · PHÒNG R&D",
                    size: 17,
                    font: FONT_FAMILY,
                    color: "64748b",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
                    bold: true,
                    size: 19,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "Độc lập - Tự do - Hạnh phúc",
                    italics: true,
                    size: 18,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "─────────",
                    size: 16,
                    font: FONT_FAMILY,
                    color: "94a3b8",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Tiêu đề báo cáo
  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({
        text: "BÁO CÁO KẾT QUẢ ĐỐI THOẠI & PHÂN TÍCH KHOA HỌC",
        bold: true,
        size: 28,
        font: FONT_FAMILY,
        color: PRIMARY_COLOR,
      }),
    ],
  });

  const subtitleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 280 },
    children: [
      new TextRun({
        text: `Đề tài: ${session.title || "Phân tích kỹ thuật & Tra cứu khoa học"}`,
        bold: true,
        italics: true,
        size: 22,
        font: FONT_FAMILY,
        color: "334155",
      }),
    ],
  });

  // Bảng thông tin hồ sơ phiên nghiên cứu
  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "e2e8f0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "e2e8f0" },
    },
    rows: [
      createMetaRow("Mã phiên lưu trữ (Session ID):", session.id),
      createMetaRow("Thời gian khởi tạo:", new Date(session.createdAt).toLocaleString("vi-VN")),
      createMetaRow("Cập nhật lần cuối:", `${dateStr} (${timeStr})`),
      createMetaRow("Mô hình AI xử lý:", session.model || "DeepSeek V4.1 Flash (LarpRouter Free Tier)"),
      createMetaRow(
        "Ngôn ngữ làm việc:",
        session.language === "vi" ? "Tiếng Việt (Vietnamese - Chuẩn mặc định)" : session.language === "zh" ? "中文 (Chinese)" : "English",
      ),
      createMetaRow(
        "Tài liệu căn cứ (Evidence Sources):",
        session.documentNames && session.documentNames.length > 0
          ? session.documentNames.join("; ")
          : "Không đính kèm tệp rời (Tham chiếu trực tiếp kho tri thức)",
      ),
      createMetaRow("Tổng số lượt đối thoại:", `${session.messages.length} lượt trao đổi`),
    ],
  });

  // Danh sách các paragraph nội dung
  const bodyParagraphs: (Paragraph | Table)[] = [
    topHeaderTable,
    titleParagraph,
    subtitleParagraph,
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: "I. TỔNG QUAN & PHẠM VI NGHIÊN CỨU (SCOPE & METHODOLOGY)",
          bold: true,
          size: 22,
          font: FONT_FAMILY,
          color: PRIMARY_COLOR,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "1. Mục đích văn bản: ",
          bold: true,
          font: FONT_FAMILY,
          size: 20,
        }),
        new TextRun({
          text: "Tài liệu này ghi nhận nguyên văn quá trình truy vấn, tổng hợp dữ liệu, đối chiếu thông số hóa chất/kỹ thuật và lập luận của Trợ lý AI dựa trên các tài liệu khoa học được cung cấp.",
          font: FONT_FAMILY,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "2. Nguyên tắc toàn vẹn dữ liệu: ",
          bold: true,
          font: FONT_FAMILY,
          size: 20,
        }),
        new TextRun({
          text: "Mọi thông số kỹ thuật (số CAS, nồng độ, nhiệt độ chớp cháy, mã nguy hại H/P, chỉ dẫn an toàn PPE) được đối chiếu từ đúng tệp SDS/MSDS do người dùng tải lên; không tự ý suy diễn hoặc bù trừ hóa chất ngoài phạm vi kiểm chứng phòng thí nghiệm.",
          font: FONT_FAMILY,
          size: 20,
        }),
      ],
    }),
    metadataTable,
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 140 },
      children: [
        new TextRun({
          text: "II. NHẬT KÝ ĐỐI THOẠI & PHÂN TÍCH KHOA HỌC CHI TIẾT",
          bold: true,
          size: 22,
          font: FONT_FAMILY,
          color: PRIMARY_COLOR,
        }),
      ],
    }),
  ];

  // Render từng message trong hội thoại
  let dialogIndex = 1;
  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i];
    const isUser = msg.role === "user";
    const msgTime = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString("vi-VN") : "";

    // Tiêu đề của lượt trao đổi
    const turnTitle = new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: isUser
            ? `Lượt [${dialogIndex}] · Câu hỏi / Đề xuất từ Nhà nghiên cứu ${msgTime ? `(${msgTime})` : ""}`
            : `Lượt [${dialogIndex}] · Phản hồi & Khuyến nghị kỹ thuật từ Trợ lý AI ${msgTime ? `(${msgTime})` : ""}`,
          bold: true,
          size: 20,
          font: FONT_FAMILY,
          color: isUser ? "0369a1" : "15803d",
        }),
      ],
    });
    bodyParagraphs.push(turnTitle);

    // Xử lý các dòng nội dung văn bản
    const contentLines = msg.content.split("\n");
    for (const rawLine of contentLines) {
      const line = rawLine.trimEnd();
      if (!line.trim()) {
        bodyParagraphs.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        continue;
      }

      // Nhận diện heading markdown
      if (line.startsWith("### ")) {
        bodyParagraphs.push(
          new Paragraph({
            spacing: { before: 140, after: 60 },
            children: [
              new TextRun({
                text: line.replace(/^###\s+/, ""),
                bold: true,
                size: 21,
                font: FONT_FAMILY,
                color: "1e293b",
              }),
            ],
          }),
        );
      } else if (line.startsWith("## ")) {
        bodyParagraphs.push(
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [
              new TextRun({
                text: line.replace(/^##\s+/, ""),
                bold: true,
                size: 22,
                font: FONT_FAMILY,
                color: PRIMARY_COLOR,
              }),
            ],
          }),
        );
      } else if (line.startsWith("# ")) {
        bodyParagraphs.push(
          new Paragraph({
            spacing: { before: 220, after: 100 },
            children: [
              new TextRun({
                text: line.replace(/^#\s+/, ""),
                bold: true,
                size: 24,
                font: FONT_FAMILY,
                color: PRIMARY_COLOR,
              }),
            ],
          }),
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        // Bullet point
        bodyParagraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: parseInlineFormatting(line.replace(/^[-*]\s+/, "")),
          }),
        );
      } else if (/^\d+\.\s+/.test(line)) {
        // Numbered list
        bodyParagraphs.push(
          new Paragraph({
            spacing: { after: 60 },
            children: parseInlineFormatting(line),
          }),
        );
      } else if (line.startsWith("> ")) {
        // Callout / Blockquote
        bodyParagraphs.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            indent: { left: 360 },
            children: [
              new TextRun({
                text: line.replace(/^>\s+/, ""),
                italics: true,
                font: FONT_FAMILY,
                size: 19,
                color: "475569",
              }),
            ],
          }),
        );
      } else {
        // Normal paragraph
        bodyParagraphs.push(
          new Paragraph({
            spacing: { after: 80 },
            children: parseInlineFormatting(line),
          }),
        );
      }
    }

    if (!isUser) {
      dialogIndex++;
    }
  }

  // Phần III: Đánh giá an toàn & Kết luận
  bodyParagraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 120 },
      children: [
        new TextRun({
          text: "III. KHUYẾN NGHỊ AN TOÀN & XÁC NHẬN KIỂM SOÁT RỦI RO",
          bold: true,
          size: 22,
          font: FONT_FAMILY,
          color: PRIMARY_COLOR,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "1. Khuyến cáo thực nghiệm: ",
          bold: true,
          font: FONT_FAMILY,
          size: 20,
        }),
        new TextRun({
          text: "Các phương án điều chỉnh tỷ lệ hóa chất cần được thử nghiệm ở quy mô mẫu nhỏ (bench scale) trước khi đưa vào sản xuất diện rộng hoặc quy trình phun rửa chính thức.",
          font: FONT_FAMILY,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: "2. Trang bị bảo hộ (PPE): ",
          bold: true,
          font: FONT_FAMILY,
          size: 20,
        }),
        new TextRun({
          text: "Bắt buộc tuân thủ găng tay chống dung môi hữu cơ (Nitrile / Butyl), kính chắn hóa chất, khẩu trang lọc hơi hữu cơ và kiểm tra hệ thống thông gió cục bộ đạt lưu lượng quy chuẩn.",
          font: FONT_FAMILY,
          size: 20,
        }),
      ],
    }),
  );

  // Phần IV: Khối chữ ký phê duyệt chuẩn khoa học
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "NGƯỜI LẬP BÁO CÁO", bold: true, size: 20, font: FONT_FAMILY }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "(Ký, ghi rõ họ tên)", italics: true, size: 17, font: FONT_FAMILY, color: "64748b" }),
                ],
              }),
              new Paragraph({ spacing: { before: 600 }, children: [] }),
            ],
          }),
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "CHUYÊN VIÊN THẨM ĐỊNH", bold: true, size: 20, font: FONT_FAMILY }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "(Ký, ghi rõ họ tên)", italics: true, size: 17, font: FONT_FAMILY, color: "64748b" }),
                ],
              }),
              new Paragraph({ spacing: { before: 600 }, children: [] }),
            ],
          }),
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "TRƯỞNG PHÒNG R&D / LAB LEAD", bold: true, size: 20, font: FONT_FAMILY }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "(Ký duyệt & đóng dấu)", italics: true, size: 17, font: FONT_FAMILY, color: "64748b" }),
                ],
              }),
              new Paragraph({ spacing: { before: 600 }, children: [] }),
            ],
          }),
        ],
      }),
    ],
  });

  bodyParagraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 120 },
      children: [
        new TextRun({
          text: "IV. XÁC NHẬN & PHÊ DUYỆT BÁO CÁO (APPROVAL & SIGNATURES)",
          bold: true,
          size: 22,
          font: FONT_FAMILY,
          color: PRIMARY_COLOR,
        }),
      ],
    }),
    signatureTable,
  );

  // Tạo tài liệu Word hoàn chỉnh
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: 20,
            color: TEXT_COLOR,
          },
          paragraph: {
            spacing: { line: 276 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 1440 dxa
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Báo cáo nghiên cứu khoa học · Hồ sơ: ${session.id.slice(0, 18)}...`,
                    size: 16,
                    font: FONT_FAMILY,
                    color: "94a3b8",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Tài liệu lưu hành nội bộ R&D · Trang ",
                    size: 16,
                    font: FONT_FAMILY,
                    color: "64748b",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: FONT_FAMILY,
                    bold: true,
                  }),
                  new TextRun({
                    text: " / ",
                    size: 16,
                    font: FONT_FAMILY,
                    color: "64748b",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    font: FONT_FAMILY,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        },
        children: bodyParagraphs,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Hỗ trợ tạo một dòng thông số trong bảng metadata Word
 */
function createMetaRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 32, type: WidthType.PERCENTAGE },
        shading: { fill: "f8fafc" },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: label,
                bold: true,
                size: 19,
                font: FONT_FAMILY,
                color: "334155",
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 68, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: value,
                size: 19,
                font: FONT_FAMILY,
                color: "0f172a",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Phân tích cú pháp Markdown inline cơ bản (in đậm, in nghiêng, code)
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: FONT_FAMILY,
          size: 20,
        }),
      );
    } else if (part.startsWith("*") && part.endsWith("*")) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          italics: true,
          font: FONT_FAMILY,
          size: 20,
        }),
      );
    } else if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          font: "Consolas",
          size: 18,
          color: "b91c1c",
        }),
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          font: FONT_FAMILY,
          size: 20,
        }),
      );
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text, font: FONT_FAMILY, size: 20 })];
}

/**
 * Tạo tài liệu HTML in ấn chuẩn khổ A4 phục vụ xuất PDF (Vector Sharp / Page Break Chuẩn)
 */
export function generateScientificPrintableHtml(session: ChatSession): string {
  const dateStr = new Date(session.updatedAt || session.createdAt).toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date(session.updatedAt || session.createdAt).toLocaleTimeString("vi-VN");

  const dialogHtml = session.messages
    .map((msg, idx) => {
      const isUser = msg.role === "user";
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString("vi-VN") : "";
      const roleBadge = isUser
        ? `<span class="badge user">👤 NHÀ NGHIÊN CỨU</span>`
        : `<span class="badge ai">🤖 TRỢ LÝ KHOA HỌC (AI)</span>`;

      // Chuyển markdown cơ bản thành HTML sạch
      const formattedContent = msg.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/^### (.*$)/gim, "<h3>$1</h3>")
        .replace(/^## (.*$)/gim, "<h2>$1</h2>")
        .replace(/^# (.*$)/gim, "<h1>$1</h1>")
        .replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>")
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br/>");

      return `
      <div class="turn-card ${isUser ? "turn-user" : "turn-ai"}">
        <div class="turn-header">
          <div class="turn-title">
            ${roleBadge}
            <span class="turn-num">Lượt #${Math.floor(idx / 2) + 1}</span>
          </div>
          <span class="turn-time">${time}</span>
        </div>
        <div class="turn-body">
          <p>${formattedContent}</p>
        </div>
      </div>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>BÁO CÁO KHOA HỌC - ${session.title || session.id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 15mm 20mm 15mm;
      @bottom-center {
        content: "Trang " counter(page) " / " counter(pages);
        font-family: 'Times New Roman', serif;
        font-size: 10pt;
        color: #64748b;
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #1e293b;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .print-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 10mm 15mm;
    }
    .header-grid {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header-left h3 {
      margin: 0;
      font-size: 11pt;
      font-weight: bold;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-left p {
      margin: 2px 0 0 0;
      font-size: 9.5pt;
      color: #64748b;
    }
    .header-right {
      text-align: right;
    }
    .header-right h3 {
      margin: 0;
      font-size: 10.5pt;
      font-weight: bold;
    }
    .header-right p {
      margin: 2px 0 0 0;
      font-size: 9.5pt;
      font-style: italic;
    }
    .report-title-box {
      text-align: center;
      margin: 25px 0 20px 0;
    }
    .report-title-box h1 {
      margin: 0;
      font-size: 16pt;
      font-weight: bold;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .report-title-box .subtitle {
      margin: 6px 0 0 0;
      font-size: 12pt;
      font-style: italic;
      color: #334155;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 10.5pt;
    }
    .meta-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 12px;
    }
    .meta-table td.label {
      background: #f8fafc;
      font-weight: bold;
      width: 30%;
      color: #334155;
    }
    h2.section-heading {
      font-size: 13pt;
      font-weight: bold;
      color: #1e3a8a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 24px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    .turn-card {
      margin-bottom: 16px;
      border-radius: 6px;
      padding: 12px 14px;
      page-break-inside: avoid;
    }
    .turn-user {
      background: #f0f9ff;
      border-left: 4px solid #0284c7;
    }
    .turn-ai {
      background: #f8fafc;
      border-left: 4px solid #16a34a;
    }
    .turn-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      border-bottom: 1px dashed rgba(0,0,0,0.1);
      padding-bottom: 4px;
    }
    .turn-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      display: inline-block;
      font-size: 8pt;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge.user { background: #bae6fd; color: #0369a1; }
    .badge.ai { background: #bbf7d0; color: #15803d; }
    .turn-num { font-size: 9.5pt; font-weight: bold; color: #475569; }
    .turn-time { font-size: 9pt; color: #64748b; font-style: italic; }
    .turn-body {
      font-size: 11pt;
      line-height: 1.5;
    }
    .turn-body h1, .turn-body h2, .turn-body h3 {
      color: #1e3a8a;
      margin: 10px 0 4px 0;
    }
    .turn-body h1 { font-size: 13pt; }
    .turn-body h2 { font-size: 12pt; }
    .turn-body h3 { font-size: 11.5pt; }
    .turn-body blockquote {
      margin: 6px 0;
      padding-left: 10px;
      border-left: 3px solid #94a3b8;
      color: #475569;
      font-style: italic;
    }
    .turn-body code {
      font-family: Consolas, monospace;
      font-size: 9.5pt;
      background: #e2e8f0;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .signatures-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 35px;
      page-break-inside: avoid;
    }
    .signature-col {
      width: 30%;
      text-align: center;
    }
    .sig-title {
      font-weight: bold;
      font-size: 10.5pt;
      margin-bottom: 2px;
    }
    .sig-note {
      font-size: 8.5pt;
      font-style: italic;
      color: #64748b;
      margin-bottom: 60px;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      width: 80%;
      margin: 0 auto;
    }
    .print-actions {
      text-align: center;
      margin-bottom: 20px;
      padding: 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
    }
    .print-btn {
      background: #1e3a8a;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 11pt;
      font-weight: bold;
      cursor: pointer;
      margin-right: 10px;
    }
    .print-btn:hover { background: #1d4ed8; }
    @media print {
      .print-actions { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="print-actions">
      <button class="print-btn" onclick="window.print()">🖨️ In Báo Cáo / Lưu dưới dạng PDF</button>
      <span>Chọn <strong>"Lưu dưới dạng PDF" (Save as PDF)</strong> trong hộp thoại in để tải file PDF chất lượng cao.</span>
    </div>

    <div class="header-grid">
      <div class="header-left">
        <h3>HỆ THỐNG TRỢ LÝ NGHIÊN CỨU KHOA HỌC</h3>
        <p>RESEARCH AGENT PLATFORM · PHÒNG THÍ NGHIỆM & R&D</p>
      </div>
      <div class="header-right">
        <h3>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
        <p>Độc lập - Tự do - Hạnh phúc</p>
      </div>
    </div>

    <div class="report-title-box">
      <h1>BÁO CÁO KẾT QUẢ ĐỐI THOẠI & PHÂN TÍCH KHOA HỌC</h1>
      <p class="subtitle">Đề tài: ${session.title || "Phân tích kỹ thuật & Tra cứu khoa học"}</p>
    </div>

    <table class="meta-table">
      <tr>
        <td class="label">Mã phiên (Session ID):</td>
        <td><code>${session.id}</code></td>
      </tr>
      <tr>
        <td class="label">Thời gian lập báo cáo:</td>
        <td>${dateStr} (${timeStr})</td>
      </tr>
      <tr>
        <td class="label">Mô hình AI xử lý:</td>
        <td><strong>${session.model || "DeepSeek V4.1 Flash (LarpRouter Free Tier)"}</strong></td>
      </tr>
      <tr>
        <td class="label">Ngôn ngữ làm việc:</td>
        <td>${session.language === "vi" ? "Tiếng Việt (Vietnamese - Chuẩn mặc định)" : session.language === "zh" ? "中文 (Chinese)" : "English"}</td>
      </tr>
      <tr>
        <td class="label">Tài liệu căn cứ (Evidence):</td>
        <td>${session.documentNames && session.documentNames.length > 0 ? session.documentNames.join("; ") : "Không đính kèm tệp rời"}</td>
      </tr>
      <tr>
        <td class="label">Tổng số lượt trao đổi:</td>
        <td>${session.messages.length} lượt tương tác</td>
      </tr>
    </table>

    <h2 class="section-heading">I. TỔNG QUAN & PHẠM VI NGHIÊN CỨU</h2>
    <p style="font-size: 11pt; line-height: 1.5; margin-bottom: 8px;">
      <strong>1. Mục đích:</strong> Văn bản ghi nhận toàn diện các câu hỏi, lập luận khoa học, kết quả giải trình phản ứng hóa học và đánh giá an toàn do hệ thống AI thực hiện dựa trên tài liệu đính kèm.
    </p>
    <p style="font-size: 11pt; line-height: 1.5; margin-bottom: 16px;">
      <strong>2. Nguyên tắc toàn vẹn:</strong> Căn cứ các thông số sản phẩm cụ thể vào đúng file và đúng phiên bản SDS/MSDS được cung cấp. Phân biệt rõ giả thuyết, ví dụ minh họa và kết quả đã kiểm chứng phòng lab.
    </p>

    <h2 class="section-heading">II. NHẬT KÝ ĐỐI THOẠI & PHÂN TÍCH KỸ THUẬT CHI TIẾT</h2>
    <div class="dialogue-container">
      ${dialogHtml}
    </div>

    <h2 class="section-heading" style="margin-top: 30px;">III. KHUYẾN NGHỊ AN TOÀN & XÁC NHẬN KIỂM SOÁT RỦI RO</h2>
    <p style="font-size: 11pt; line-height: 1.5; margin-bottom: 6px;">
      • <strong>Thử nghiệm quy mô nhỏ:</strong> Bắt buộc thử nghiệm quy mô phòng thí nghiệm trước khi áp dụng thay đổi công thức vào dây chuyền sản xuất.
    </p>
    <p style="font-size: 11pt; line-height: 1.5; margin-bottom: 16px;">
      • <strong>Kiểm soát PPE & Thông gió:</strong> Duy trì quạt hút cưỡng bức đạt tiêu chuẩn và trang bị bảo hộ chuyên dụng kháng dung môi hữu cơ.
    </p>

    <h2 class="section-heading">IV. PHẦN KÝ DUYỆT BÁO CÁO (APPROVALS)</h2>
    <div class="signatures-grid">
      <div class="signature-col">
        <div class="sig-title">NGƯỜI LẬP BÁO CÁO</div>
        <div class="sig-note">(Ký, ghi rõ họ tên)</div>
        <div class="sig-line"></div>
      </div>
      <div class="signature-col">
        <div class="sig-title">CHUYÊN VIÊN THẨM ĐỊNH</div>
        <div class="sig-note">(Ký, ghi rõ họ tên)</div>
        <div class="sig-line"></div>
      </div>
      <div class="signature-col">
        <div class="sig-title">TRƯỞNG PHÒNG R&D / LAB LEAD</div>
        <div class="sig-note">(Ký duyệt & đóng dấu)</div>
        <div class="sig-line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Kích hoạt mở trang in chuẩn A4 để người dùng xuất/lưu file PDF
 */
export function openScientificPdfPrintView(session: ChatSession): void {
  const html = generateScientificPrintableHtml(session);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
