async function testAllModels() {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || "https://larprouter.com/v1";

  const models = [
    'claude-opus-4-6',
    'claude-opus-4-7-1m',
    'deepseek-v4.1-flash',
    'deepseek-v4.1-flash-fast',
    'gemini-3.8-flash-high',
    'glm-5.2',
    'glm-5.3',
    'glm-5.3-flash',
    'glm-5.3-flash-uncensored',
    'glm-5.3-uncensored',
    'hy4-preview',
    'kimi-k2.6',
    'kimi-k2.7',
    'kimi-k2.8-preview',
    'kimi-k3',
    'clef-flash',
    'unknown-model-xyz'
  ];

  for (const m of models) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: "test" }],
          max_tokens: 10,
        }),
      });
      console.log(`Model [${m}]: Status ${res.status} ${res.statusText}`);
      if (res.status !== 200 && res.status !== 402) {
        const body = await res.text();
        console.log(`  -> Body:`, body);
      }
    } catch (e) {
      console.log(`Model [${m}]: Error ${e.message}`);
    }
  }
}

testAllModels().catch(console.error);
