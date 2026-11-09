import { authConfigured, authenticated } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function GET() {
  const cloudStorage =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;
  const ai = !!process.env.AI_API_KEY && authConfigured();
  const experiential = !!process.env.EXPERIENTIAL_API_KEY;
  let aiProvider = "Dịch vụ AI";
  try {
    if (
      new URL(process.env.AI_BASE_URL || "https://api.openai.com/v1")
        .hostname === "larprouter.com"
    )
      aiProvider = "LarpRouter";
  } catch {
    /* The chat endpoint reports an invalid provider configuration. */
  }
  const isLarp = aiProvider === "LarpRouter";
  const availableModels = isLarp ? [
    { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash 1017", provider: "DeepSeek", tier: "free", isDefault: true, description: "Miễn phí 100% · Phản hồi nhanh · Phân tích sâu" },
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash", provider: "Z.ai", tier: "free", isDefault: false, description: "Miễn phí 100% · Dự phòng an toàn" },
    { id: "deepseek-v4.1-flash-fast", name: "DeepSeek V4.1 Flash Fast", provider: "CoralBricks", tier: "paid", requiresCredit: true, description: "Cần nạp credit trên LarpRouter" },
    { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash High", provider: "Google", tier: "paid", requiresCredit: true, description: "Cần nạp credit trên LarpRouter" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "Anthropic", tier: "paid", requiresCredit: true, description: "Cần nạp credit trên LarpRouter" },
    { id: "kimi-k2.6", name: "Kimi K2.6", provider: "Moonshot", tier: "paid", requiresCredit: true, description: "Cần nạp credit trên LarpRouter" },
    { id: "kimi-k3", name: "Kimi K3", provider: "Moonshot", tier: "paid", requiresCredit: true, description: "Cần nạp credit trên LarpRouter" },
  ] : [
    { id: process.env.AI_MODEL || "deepseek-v4.1-flash", name: process.env.AI_MODEL || "deepseek-v4.1-flash", provider: "AI Provider", tier: "default" }
  ];

  return Response.json(
    {
      ai,
      aiProvider: ai ? aiProvider : null,
      aiModel: ai ? process.env.AI_MODEL || "deepseek-v4.1-flash" : null,
      isFreeTier: isLarp,
      freeTierModels: ["deepseek-v4.1-flash", "glm-5.3-flash"],
      availableModels: ai ? availableModels : [],
      experiential: {
        configured: experiential,
        provider: "Experiential Labs",
        decisionModel: "gpt-6-luna-decisions",
        description: "OpenAI GPT-6 Luna Decisions (Thẩm định xác suất & ra quyết định nghiên cứu)",
      },
      authConfigured: authConfigured(),
      authenticated: await authenticated(),
      cloudStorage,
      durableQuota: cloudStorage,
      storage: cloudStorage ? "redis-available" : "browser-local",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
