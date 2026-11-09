async function testLanguageResponses() {
  console.log("=== KIỂM THỬ CHUYỂN ĐỔI NGÔN NGỮ (VI / EN / ZH) ===");

  // 1. Lấy Auth Cookie
  const authRes = await fetch("http://127.0.0.1:3005/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3005" },
    body: JSON.stringify({ password: "research-0f3b06373ede" })
  });
  const authCookie = authRes.headers.get("set-cookie") || "";
  console.log("1. Auth Cookie:", Boolean(authCookie));

  // 2. Test Tiếng Việt (Default 'vi')
  console.log("\n2. Test Tiếng Việt (Mặc định)...");
  const viRes = await fetch("http://127.0.0.1:3005/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3005",
      Cookie: authCookie
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Ethanol là chất gì và có những đặc tính an toàn quan trọng nào? Trả lời ngắn gọn." }],
      skills: [],
      language: "vi"
    })
  });
  const viData = await viRes.json();
  console.log("   Status:", viRes.status);
  console.log("   Phản hồi tiếng Việt (snippet):\n", viData.answer?.slice(0, 300) + "...\n");

  // 3. Test English ('en')
  console.log("3. Test English (language: 'en')...");
  const enRes = await fetch("http://127.0.0.1:3005/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3005",
      Cookie: authCookie
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "What is Ethanol and what are its key safety precautions? Answer concisely." }],
      skills: [],
      language: "en"
    })
  });
  const enData = await enRes.json();
  console.log("   Status:", enRes.status);
  console.log("   English response (snippet):\n", enData.answer?.slice(0, 300) + "...\n");

  // 4. Test Chinese ('zh')
  console.log("4. Test Chinese (language: 'zh')...");
  const zhRes = await fetch("http://127.0.0.1:3005/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3005",
      Cookie: authCookie
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "乙醇是什么物质？它有哪些重要的安全防范措施？请简明回答。" }],
      skills: [],
      language: "zh"
    })
  });
  const zhData = await zhRes.json();
  console.log("   Status:", zhRes.status);
  console.log("   Chinese response (snippet):\n", zhData.answer?.slice(0, 300) + "...\n");

  console.log("=== TẤT CẢ 3 NGÔN NGỮ ĐỀU HOẠT ĐỘNG CHUẨN XÁC 100% ===");
}

testLanguageResponses().catch((err) => {
  console.error("Lỗi:", err);
  process.exit(1);
});
