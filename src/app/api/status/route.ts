import { authConfigured, authenticated } from "@/lib/security";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cloudStorage =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;
  const customExp = request.headers.get("x-experiential-key")?.trim();
  const experiential = !!process.env.EXPERIENTIAL_API_KEY || !!customExp || true;
  const ai = (!!process.env.AI_API_KEY && authConfigured()) || experiential;

  const aiProvider = "Experiential Labs & LarpRouter";

  const availableModels = [
    // 1. Siêu mô hình Experiential Labs (Chạy trực tiếp qua Experiential Cloud - Khuyên dùng)
    { id: "gpt-6-luna", name: "GPT-6 Luna (Flagship)", provider: "Experiential (OpenAI)", tier: "experiential", isDefault: false, description: "OpenAI GPT-6 Luna trên Experiential Cloud - Khả năng suy luận & phân tích khoa học đỉnh cao" },
    { id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6", provider: "Experiential (Anthropic)", tier: "experiential", isDefault: false, description: "Anthropic Claude Sonnet 4.6 - Viết báo cáo & diễn giải tiếng Việt xuất sắc" },
    { id: "claude-opus-4.6", name: "Claude Opus 4.6", provider: "Experiential (Anthropic)", tier: "experiential", isDefault: false, description: "Anthropic Claude Opus 4.6 - Mô hình suy luận lớn nhất của Anthropic" },
    { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", provider: "Experiential (Google)", tier: "experiential", isDefault: false, description: "Google Gemini 3.8 Flash - Xử lý cực nhanh" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Experiential (Google)", tier: "experiential", isDefault: false, description: "Google Gemini 2.5 Pro - Phân tích khoa học đa phương thức" },
    { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", provider: "Experiential (OpenAI)", tier: "experiential", isDefault: false, description: "OpenAI GPT-5.6 Luna - Phân tích logic và thuật toán chuyên sâu" },
    { id: "gpt-5.4-pro", name: "GPT-5.4 Pro", provider: "Experiential (OpenAI)", tier: "experiential", isDefault: false, description: "OpenAI GPT-5.4 Pro - Suy luận sâu & kiểm chứng giả thuyết" },
    { id: "gpt-4.1", name: "GPT-4.1 Flagship", provider: "Experiential (OpenAI)", tier: "experiential", isDefault: false, description: "OpenAI GPT-4.1 Flagship - Chuẩn xác & toàn diện" },
    { id: "grok-4", name: "Grok 4", provider: "Experiential (xAI)", tier: "experiential", isDefault: false, description: "xAI Grok 4 - Lập luận logic sắc bén" },
    { id: "kimi-k3", name: "Kimi K3", provider: "Experiential (Moonshot)", tier: "experiential", isDefault: false, description: "Moonshot Kimi K3 - Đọc tài liệu dài & context lớn" },
    { id: "qwen3.8-max", name: "Qwen 3.8 Max", provider: "Experiential (Alibaba)", tier: "experiential", isDefault: false, description: "Alibaba Qwen 3.8 Max - Mạnh mẽ đa nhiệm" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "Experiential (DeepSeek)", tier: "experiential", isDefault: false, description: "DeepSeek V4 Pro - Nghiên cứu chuyên sâu" },

    // 2. Mô hình phân tích MSDS & Tốc độ cao
    { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", provider: "Experiential (DeepSeek)", tier: "free", isDefault: true, description: "DeepSeek V4.1 Flash - Chuyên gia đối chiếu MSDS hóa chất & an toàn" },
    { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "Experiential (Anthropic)", tier: "free", isDefault: false, description: "Anthropic Claude Haiku 4.5 - Tốc độ tức thì, tiếng Việt chuẩn xác" },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "Experiential (OpenAI)", tier: "free", isDefault: false, description: "OpenAI GPT-4.1 Mini - Phản hồi nhanh, tính toán nồng độ" },
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash", provider: "Experiential (Z.ai)", tier: "free", isDefault: false, description: "Z.ai GLM 5.3 Flash - Dự phòng an toàn" },

    // 3. Mô hình LarpRouter (Nguồn phụ)
    { id: "deepseek-v4.1-flash-fast", name: "DeepSeek V4.1 Flash Fast", provider: "CoralBricks (LarpRouter)", tier: "paid", requiresCredit: true, description: "Chạy qua LarpRouter" },
    { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash High", provider: "Google (LarpRouter)", tier: "paid", requiresCredit: true, description: "Chạy qua LarpRouter" },
    { id: "kimi-k2.6", name: "Kimi K2.6", provider: "Moonshot (LarpRouter)", tier: "paid", requiresCredit: true, description: "Chạy qua LarpRouter" },
  ];

  return Response.json(
    {
      ai,
      aiProvider,
      aiModel: process.env.AI_MODEL || "deepseek-v4.1-flash",
      isFreeTier: false,
      freeTierModels: ["deepseek-v4.1-flash", "claude-haiku-4.5", "gpt-4.1-mini", "glm-5.3-flash"],
      availableModels,
      experiential: {
        configured: true,
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
