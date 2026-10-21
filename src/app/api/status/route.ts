import { authConfigured, authenticated } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function GET() {
  const cloudStorage =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;
  const ai = !!process.env.AI_API_KEY && authConfigured();
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
  const availableModels = aiProvider === "LarpRouter" ? [
    { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash (Free)", provider: "DeepSeek", tier: "free" },
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash (Free)", provider: "Z.ai", tier: "free" },
    { id: "deepseek-v4.1-flash-fast", name: "DeepSeek V4.1 Flash Fast", provider: "CoralBricks", tier: "standard" },
    { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)", provider: "Google", tier: "standard" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "Anthropic", tier: "standard" },
    { id: "kimi-k2.6", name: "Kimi K2.6", provider: "Moonshot", tier: "standard" },
    { id: "kimi-k3", name: "Kimi K3", provider: "Moonshot", tier: "standard" },
  ] : [
    { id: process.env.AI_MODEL || "gpt-4.1-mini", name: process.env.AI_MODEL || "gpt-4.1-mini", provider: "AI Provider", tier: "default" }
  ];

  return Response.json(
    {
      ai,
      aiProvider: ai ? aiProvider : null,
      aiModel: ai ? process.env.AI_MODEL || "deepseek-v4.1-flash" : null,
      availableModels: ai ? availableModels : [],
      authConfigured: authConfigured(),
      authenticated: await authenticated(),
      cloudStorage,
      durableQuota: cloudStorage,
      storage: cloudStorage ? "redis-available" : "browser-local",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
