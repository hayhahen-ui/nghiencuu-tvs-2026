import { z } from "zod";
import { authenticated, boundedJson, sameOrigin } from "@/lib/security";
import type { ChatSession } from "@/lib/chat-history-store";
import { generateScientificWordBuffer } from "@/lib/scientific-export";
import { normalizeReportTitle } from "@/lib/report-formatter";

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
      model: z.string().optional(),
      requestedModel: z.string().optional(),
      fallbackApplied: z.boolean().optional(),
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
    const buffer = await generateScientificWordBuffer(session);
    const cleanTitle = normalizeReportTitle(session.title);
    const safeTitle = cleanTitle
      .replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, "_")
      .replace(/_+/g, "_")
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
