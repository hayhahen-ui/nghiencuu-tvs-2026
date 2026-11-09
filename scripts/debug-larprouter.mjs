async function debugLarp() {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || "https://larprouter.com/v1";
  console.log("Base URL:", baseUrl);
  console.log("API Key:", apiKey?.slice(0, 10) + "...");

  // 1. GET /models
  console.log("\n--- 1. GET /models ---");
  try {
    const mRes = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    console.log("Models Status:", mRes.status);
    const mData = await mRes.json();
    console.log("Available models count:", mData.data?.length);
    console.log("Models IDs:", mData.data?.map(m => m.id));
  } catch (err) {
    console.error("GET /models failed:", err.message);
  }

  // 2. Test chat with max_tokens: 2048
  console.log("\n--- 2. Chat with max_tokens: 2048 ---");
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4.1-flash",
        messages: [{ role: "user", content: "Xin chào, hãy trả lời ngắn gọn: 1+1=?" }],
        max_tokens: 2048,
      }),
    });
    console.log("Status 2048:", res.status);
    const txt = await res.text();
    console.log("Response 2048 snippet:", txt.slice(0, 200));
  } catch (err) {
    console.error("Chat 2048 failed:", err.message);
  }

  // 3. Test chat with max_tokens: 4096
  console.log("\n--- 3. Chat with max_tokens: 4096 ---");
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4.1-flash",
        messages: [{ role: "user", content: "Xin chào, hãy trả lời ngắn gọn: 2+2=?" }],
        max_tokens: 4096,
      }),
    });
    console.log("Status 4096:", res.status);
    const txt = await res.text();
    console.log("Response 4096 snippet:", txt.slice(0, 200));
  } catch (err) {
    console.error("Chat 4096 failed:", err.message);
  }

  // 4. Test GLM 5.3 Flash
  console.log("\n--- 4. Chat with glm-5.3-flash ---");
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "glm-5.3-flash",
        messages: [{ role: "user", content: "Xin chào, hãy trả lời ngắn gọn: 3+3=?" }],
        max_tokens: 2048,
      }),
    });
    console.log("Status glm-5.3-flash:", res.status);
    const txt = await res.text();
    console.log("Response glm-5.3-flash snippet:", txt.slice(0, 200));
  } catch (err) {
    console.error("Chat glm-5.3-flash failed:", err.message);
  }
}

debugLarp().catch(console.error);
