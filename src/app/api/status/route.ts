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
  const availableModels = isLarp || experiential ? [
    { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", provider: "DeepSeek", tier: "free", isDefault: true, description: "Miễn phí 100% · Phân tích sâu & đối chiếu MSDS hóa chất" },
    { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "Anthropic", tier: "free", isDefault: false, description: "Miễn phí 100% · Tiếng Việt tự nhiên & phản hồi tức thì" },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI", tier: "free", isDefault: false, description: "Miễn phí 100% · Tính toán nồng độ & an toàn quy trình" },
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
      aiProvider: experiential ? "Experiential Labs & LarpRouter" : (ai ? aiProvider : null),
      aiModel: ai ? process.env.AI_MODEL || "deepseek-v4.1-flash" : null,
      isFreeTier: isLarp || experiential,
      freeTierModels: ["deepseek-v4.1-flash", "claude-haiku-4.5", "gpt-4.1-mini", "glm-5.3-flash"],
      availableModels: ai || experiential ? availableModels : [],
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
