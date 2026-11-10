import { boundedJson, sameOrigin } from "@/lib/security";

export const maxDuration = 30;

function cleanBaseUrl(url: string): string {
  let u = url.trim();
  // Loại bỏ các đường dẫn con nếu người dùng vô tình nhập kèm /decisions hoặc /chat/completions
  u = u.replace(/\/decisions\/?$/, "");
  u = u.replace(/\/chat\/completions\/?$/, "");
  u = u.replace(/\/models\/?$/, "");
  u = u.replace(/\/+$/, "");
  return u;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }

  try {
    const body = (await boundedJson(request, 20_000)) as {
      expKey?: string;
      aiKey?: string;
      baseUrl?: string;
    };

    const expKey =
      body.expKey?.trim() ||
      process.env.EXPERIENTIAL_API_KEY ||
      "xpl_403f9644e5ecda298ae346a48694448ec6c0d2a2";
    const customAiKey = body.aiKey?.trim();
    let customBaseUrl = body.baseUrl?.trim() || "";
    if (customBaseUrl) {
      customBaseUrl = cleanBaseUrl(customBaseUrl);
    }

    const results: Array<{
      provider: string;
      status: "success" | "error";
      latencyMs: number;
      message: string;
      models?: string[];
    }> = [];

    const isExperiential = (url: string) => /experientiallabs\.ai/i.test(url);

    // 1. Kiểm tra kết nối Experiential Labs
    const expBase = (customBaseUrl && isExperiential(customBaseUrl)) ? customBaseUrl : "https://api.experientiallabs.ai/v1";

    if (expKey) {
      const start = Date.now();
      try {
        const res = await fetch(`${expBase.replace(/\/$/, "")}/models`, {
          headers: {
            Authorization: `Bearer ${expKey}`,
            "User-Agent": "ResearchAgent/1.0 (Connection Test)",
          },
          signal: AbortSignal.timeout(15000),
        });
        const latency = Date.now() - start;
        if (res.ok) {
          results.push({
            provider: "Experiential Labs (Claude, DeepSeek, GPT-6 Luna)",
            status: "success",
            latencyMs: latency,
            message: `Kết nối thành công (${latency}ms)! Khóa API hoạt động hoàn hảo.${customBaseUrl && isExperiential(customBaseUrl) ? " (Đã kết nối qua endpoint Experiential Labs)" : ""}`,
            models: ["claude-fable-5.2", "gpt-6-luna-decisions", "claude-haiku-4.5", "deepseek-v4.1-flash", "gpt-4.1-mini"],
          });
        } else {
          const errText = await res.text().catch(() => "");
          results.push({
            provider: "Experiential Labs",
            status: "error",
            latencyMs: latency,
            message: `Mã lỗi ${res.status}: ${errText.slice(0, 150) || "API key không hợp lệ"}`,
          });
        }
      } catch (err: any) {
        results.push({
          provider: "Experiential Labs",
          status: "error",
          latencyMs: Date.now() - start,
          message: `Không thể kết nối: ${err?.message || "Hết thời gian chờ (Timeout)"}`,
        });
      }
    }

    // 2. Kiểm tra kết nối Custom Provider phụ (LarpRouter / OpenAI / bên thứ 3)
    // CHỈ kiểm tra nếu:
    // - Người dùng nhập customAiKey (khác với expKey và không phải là key xpl_)
    // - HOẶC người dùng nhập customBaseUrl riêng biệt (KHÔNG trỏ về experientiallabs.ai)
    const hasDistinctCustomUrl = Boolean(customBaseUrl && !isExperiential(customBaseUrl));
    const hasDistinctAiKey = Boolean(customAiKey && customAiKey !== expKey && !customAiKey.startsWith("xpl_"));

    if (hasDistinctAiKey || hasDistinctCustomUrl) {
      const targetBase = hasDistinctCustomUrl ? customBaseUrl : (process.env.AI_BASE_URL || "https://api.openai.com/v1");
      const targetKey = customAiKey || process.env.AI_API_KEY;

      if (targetKey) {
        const start = Date.now();
        try {
          const res = await fetch(`${targetBase.replace(/\/$/, "")}/models`, {
            headers: {
              Authorization: `Bearer ${targetKey}`,
              "User-Agent": "ResearchAgent/1.0 (Connection Test)",
            },
            signal: AbortSignal.timeout(15000),
          });
          const latency = Date.now() - start;
          if (res.ok) {
            results.push({
              provider: hasDistinctCustomUrl ? customBaseUrl : "Nguồn phụ (OpenAI / LarpRouter)",
              status: "success",
              latencyMs: latency,
              message: `Kết nối thành công (${latency}ms)!`,
            });
          } else {
            const errText = await res.text().catch(() => "");
            results.push({
              provider: hasDistinctCustomUrl ? customBaseUrl : "Nguồn phụ (OpenAI / LarpRouter)",
              status: "error",
              latencyMs: latency,
              message: `Máy chủ trả mã lỗi ${res.status}: ${errText.slice(0, 150) || "Không xác thực được"}`,
            });
          }
        } catch (err: any) {
          results.push({
            provider: hasDistinctCustomUrl ? customBaseUrl : "Nguồn phụ",
            status: "error",
            latencyMs: Date.now() - start,
            message: `Lỗi kết nối tới ${targetBase}: ${err?.message || "Timeout"}`,
          });
        }
      }
    }

    return Response.json({
      success: true,
      cleanedBaseUrl: customBaseUrl,
      results,
    });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Không thể thực hiện kiểm tra kết nối." },
      { status: 500 },
    );
  }
}
