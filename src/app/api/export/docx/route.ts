import { z } from "zod";
import { authenticated, boundedJson, sameOrigin } from "@/lib/security";
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
} from "docx";
import type { ChatSession } from "@/lib/chat-history-store";

export const maxDuration = 30;

const sessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  model: z.string(),
  language: z.enum(["vi", "en", "zh"]).default("vi"),
  documentNames: z.array(z.string()).optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      timestamp: z.string().optional(),
    }),
  ),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }

  if (!(await authenticated())) {
    return Response.json({ error: "Đăng nhập để xuất báo cáo khoa học." }, { status: 401 });
  }

  try {
    const session = sessionSchema.parse(await boundedJson(request, 1_000_000)) as ChatSession;
    const FONT_FAMILY = "Times New Roman";
    const PRIMARY_COLOR = "1e3a8a";
    const TEXT_COLOR = "1f2937";
    const BORDER_COLOR = "cbd5e1";

    const dateStr = new Date(session.updatedAt || session.createdAt).toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = new Date(session.updatedAt || session.createdAt).toLocaleTimeString("vi-VN");

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
              ],
            }),
          ],
        }),
      ],
    });

    const bodyParagraphs: (Paragraph | Table)[] = [
      topHeaderTable,
      new Paragraph({
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
      }),
      new Paragraph({
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
      }),
    ];

    // Meta rows
    const metaRowsData = [
      ["Mã phiên nghiên cứu:", session.id],
      ["Thời gian xuất:", `${dateStr} (${timeStr})`],
      ["Mô hình AI thực thi:", session.model],
      ["Ngôn ngữ làm việc:", session.language === "vi" ? "Tiếng Việt" : session.language === "zh" ? "中文" : "English"],
      ["Tài liệu căn cứ:", session.documentNames?.join("; ") || "Không có tệp đính kèm"],
      ["Tổng số lượt trao đổi:", `${session.messages.length} lượt`],
    ];

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
      rows: metaRowsData.map(
        ([label, value]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 32, type: WidthType.PERCENTAGE },
                shading: { fill: "f8fafc" },
                children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, font: FONT_FAMILY })] })],
              }),
              new TableCell({
                width: { size: 68, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: value, size: 19, font: FONT_FAMILY })] })],
              }),
            ],
          }),
      ),
    });

    bodyParagraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: "I. TỔNG QUAN & PHẠM VI NGHIÊN CỨU",
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
            text: "Báo cáo này lưu trữ toàn bộ dữ liệu truy vấn kỹ thuật, phân tích an toàn hóa chất và đánh giá của trợ lý AI căn cứ trên tài liệu người dùng cung cấp.",
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
            text: "II. NHẬT KÝ ĐỐI THOẠI & PHÂN TÍCH CHI TIẾT",
            bold: true,
            size: 22,
            font: FONT_FAMILY,
            color: PRIMARY_COLOR,
          }),
        ],
      }),
    );

    let idx = 1;
    for (const msg of session.messages) {
      const isUser = msg.role === "user";
      bodyParagraphs.push(
        new Paragraph({
          spacing: { before: 180, after: 80 },
          children: [
            new TextRun({
              text: isUser ? `Lượt [${idx}] · Nhà nghiên cứu hỏi:` : `Lượt [${idx}] · Trợ lý AI phân tích:`,
              bold: true,
              size: 20,
              font: FONT_FAMILY,
              color: isUser ? "0369a1" : "15803d",
            }),
          ],
        }),
      );

      const lines = msg.content.split("\n");
      for (const line of lines) {
        if (!line.trim()) {
          bodyParagraphs.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
          continue;
        }
        bodyParagraphs.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: line, font: FONT_FAMILY, size: 20 })],
          }),
        );
      }
      if (!isUser) idx++;
    }

    // Phần IV Signatures
    const sigTable = new Table({
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
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NGƯỜI LẬP BÁO CÁO", bold: true, size: 20, font: FONT_FAMILY })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, ghi rõ họ tên)", italics: true, size: 17, font: FONT_FAMILY, color: "64748b" })] }),
                new Paragraph({ spacing: { before: 600 }, children: [] }),
              ],
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CHUYÊN VIÊN THẨM ĐỊNH", bold: true, size: 20, font: FONT_FAMILY })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, ghi rõ họ tên)", italics: true, size: 17, font: FONT_FAMILY, color: "64748b" })] }),
                new Paragraph({ spacing: { before: 600 }, children: [] }),
              ],
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TRƯỞNG PHÒNG R&D", bold: true, size: 20, font: FONT_FAMILY })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký duyệt & đóng dấu)", italics: true, size: 17, font: FONT_FAMILY, color: "64748b" })] }),
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
            text: "III. XÁC NHẬN & PHÊ DUYỆT BÁO CÁO",
            bold: true,
            size: 22,
            font: FONT_FAMILY,
            color: PRIMARY_COLOR,
          }),
        ],
      }),
      sigTable,
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: `Báo cáo nghiên cứu khoa học · Mã: ${session.id}`, size: 16, font: FONT_FAMILY, color: "94a3b8" })],
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
                    new TextRun({ text: "Trang ", size: 16, font: FONT_FAMILY, color: "64748b" }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT_FAMILY, bold: true }),
                    new TextRun({ text: " / ", size: 16, font: FONT_FAMILY, color: "64748b" }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: FONT_FAMILY, bold: true }),
                  ],
                }),
              ],
            }),
          },
          children: bodyParagraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeTitle = (session.title || "Bao_cao_nghien_cuu")
      .replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, "_")
      .slice(0, 40);
    const filename = `BAO_CAO_NGHIEN_CUU_${safeTitle}_${session.id.slice(-6)}.docx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Không thể tạo file Word chuẩn nghiên cứu." },
      { status: 500 },
    );
  }
}
