async function testFreeTier() {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || "https://larprouter.com/v1";

  // Test 1: Non-free model (e.g. deepseek-v4.1-flash-fast or claude or gemini)
  console.log("--- TEST non-free model: deepseek-v4.1-flash-fast ---");
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4.1-flash-fast",
        messages: [{ role: "user", content: "test" }],
      }),
    });
    console.log("Status:", res.status, res.statusText);
    const body = await res.text();
    console.log("Body:", body);
  } catch (e) {
    console.error("Error:", e.message);
  }

  // Test 2: gemini-3.8-flash-high
  console.log("\n--- TEST non-free model: gemini-3.8-flash-high ---");
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-3.8-flash-high",
        messages: [{ role: "user", content: "test" }],
      }),
    });
    console.log("Status:", res.status, res.statusText);
    const body = await res.text();
    console.log("Body:", body);
  } catch (e) {
    console.error("Error:", e.message);
  }

  // Test 3: Free model with large prompt (similar to user's 4 documents + 14 skills)
  console.log("\n--- TEST free model: deepseek-v4.1-flash with large prompt ---");
  try {
    const largeContent = "Đây là tài liệu hóa chất mẫu: ".repeat(1500); // ~40KB
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4.1-flash",
        messages: [
          { role: "system", content: "Bạn là trợ lý hóa học." },
          { role: "user", content: largeContent }
        ],
        max_tokens: 4000,
      }),
    });
    console.log("Status with large prompt:", res.status, res.statusText);
    const body = await res.text();
    console.log("Body snippet:", body.slice(0, 300));
  } catch (e) {
    console.error("Large prompt error:", e.message);
  }

  // Test 4: Free model with max_tokens: 8000
  console.log("\n--- TEST free model: deepseek-v4.1-flash with max_tokens: 8000 ---");
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4.1-flash",
        messages: [
          { role: "user", content: "Hãy viết 1 đoạn văn tiếng Việt." }
        ],
        max_tokens: 8000,
      }),
    });
    console.log("Status with max_tokens 8000:", res.status, res.statusText);
    const body = await res.text();
    console.log("Body snippet:", body.slice(0, 300));
  } catch (e) {
    console.error("max_tokens 8000 error:", e.message);
  }
}

testFreeTier().catch(console.error);
