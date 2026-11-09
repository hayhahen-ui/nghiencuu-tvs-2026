import { z } from "zod";
import { authenticated, boundedJson, sameOrigin } from "@/lib/security";

export const maxDuration = 45;

const decisionSchema = z.object({
  input: z.string().min(3).max(25000),
  mode: z.enum(["safety", "hypothesis", "review", "custom"]).optional().default("safety"),
  questions: z
    .array(
      z.object({
        type: z.enum(["choice", "predicate", "score"]),
        name: z.string(),
        instructions: z.string(),
        choices: z
          .array(
            z.object({
              value: z.string(),
              description: z.string().optional(),
            }),
          )
          .optional(),
        levels: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  model: z.string().optional().default("gpt-6-luna-decisions"),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }

  if (!(await authenticated())) {
    return Response.json({ error: "Đăng nhập để sử dụng tính năng thẩm định quyết định." }, { status: 401 });
  }

  const apiKey = process.env.EXPERIENTIAL_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Chưa cấu hình EXPERIENTIAL_API_KEY cho mô hình GPT-6 Luna Decisions." },
      { status: 503 },
    );
  }

  try {
    const body = decisionSchema.parse(await boundedJson(request, 300_000));
    const baseUrl = process.env.EXPERIENTIAL_BASE_URL || "https://api.experientiallabs.ai/v1";

    let questions = body.questions;
    if (!questions || questions.length === 0) {
      if (body.mode === "safety") {
        questions = [
          {
            type: "choice",
            name: "safety_review",
            instructions:
              "Dựa trên các nguyên tắc an toàn hóa chất và quy trình nghiên cứu khoa học: Đề xuất này có đầy đủ cơ sở khoa học để chấp thuận ngay (accept), hay tiềm ẩn rủi ro/thiếu bằng chứng cần xem xét lại tài liệu SDS và thử nghiệm kiểm chứng (review)?",
            choices: [
              {
                value: "accept",
                description: "Phương án an toàn, có căn cứ vững chắc và có thể tiến hành.",
              },
              {
                value: "review",
                description: "Tiềm ẩn rủi ro hoặc thiếu tài liệu kiểm chứng; bắt buộc phải thẩm định lại.",
              },
            ],
          },
        ];
      } else if (body.mode === "hypothesis") {
        questions = [
          {
            type: "choice",
            name: "hypothesis_validity",
            instructions:
              "Đánh giá tính khả thi và hợp lý của giả thuyết nghiên cứu được nêu: Giả thuyết có cơ sở lý thuyết thuyết phục để thử nghiệm (accept), hay còn mâu thuẫn/thiếu dữ liệu tham chiếu (review)?",
            choices: [
              {
                value: "accept",
                description: "Giả thuyết hợp lý, có tính khả thi khoa học cao.",
              },
              {
                value: "review",
                description: "Giả thuyết chưa đủ bằng chứng hoặc có điểm mâu thuẫn cần rà soát lại.",
              },
            ],
          },
        ];
      } else {
        questions = [
          {
            type: "choice",
            name: "general_review",
            instructions:
              "Does the supplied evidence support accepting this proposal/change, or does it need further review?",
            choices: [
              {
                value: "accept",
                description: "The proposal meets the criteria and is supported by sufficient evidence.",
              },
              {
                value: "review",
                description: "Evidence is missing or insufficient; requires further review.",
              },
            ],
          },
        ];
      }
    }

    const payload = {
      model: body.model || "gpt-6-luna-decisions",
      input: body.input,
      questions,
    };

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/decisions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "ResearchAgent/1.0 (GPT-6 Luna Decisions Client)",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(40000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return Response.json(
        {
          error: `Experiential Labs trả lỗi (${res.status}): ${errText.slice(0, 300) || "Yêu cầu thẩm định thất bại"}`,
        },
        { status: 502 },
      );
    }

    const result = await res.json();
    return Response.json({
      success: true,
      model: result.model || body.model,
      provider: result.provider || "OpenAI via Experiential Cloud",
      answers: result.answers || [],
      usage: result.usage || null,
      evaluatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Dữ liệu thẩm định không đúng định dạng." }, { status: 400 });
    }
    return Response.json(
      { error: error?.message || "Không thể thực hiện thẩm định quyết định." },
      { status: 500 },
    );
  }
}
