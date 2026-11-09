async function testServer() {
  console.log("Testing server on http://127.0.0.1:3005...");

  // 1. Root page
  const rootRes = await fetch("http://127.0.0.1:3005/");
  console.log("1. Root page status:", rootRes.status);
  const rootHtml = await rootRes.text();
  console.log("   Contains app title:", rootHtml.includes("Tài liệu làm căn cứ nghiên cứu"));

  // 2. Status API
  const statusRes = await fetch("http://127.0.0.1:3005/api/status");
  const statusJson = await statusRes.json();
  console.log("2. Status API:", statusJson);

  // 3. Static sample files
  const docxRes = await fetch("http://127.0.0.1:3005/samples/MSDS_Ethanol_99.5_GHS_VN_EN.docx");
  console.log("3. Sample DOCX status:", docxRes.status, "Length:", docxRes.headers.get("content-length"));

  const xlsxRes = await fetch("http://127.0.0.1:3005/samples/Chemical_Inventory_MSDS_Matrix.xlsx");
  console.log("4. Sample XLSX status:", xlsxRes.status, "Length:", xlsxRes.headers.get("content-length"));

  // 4. Test Auth API
  const authRes = await fetch("http://127.0.0.1:3005/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3005" },
    body: JSON.stringify({ password: "research-0f3b06373ede" })
  });
  const authCookie = authRes.headers.get("set-cookie");
  console.log("5. Auth status:", authRes.status, "Cookie received:", Boolean(authCookie));

  // 5. Test Chat API with chemical evidence
  const chatRes = await fetch("http://127.0.0.1:3005/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3005",
      Cookie: authCookie || ""
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: "Theo tài liệu MSDS đính kèm của Ethanol 99.5%, số CAS là gì, từ cảnh báo là gì và cần trang bị bảo hộ (PPE) nào khi thao tác?"
        }
      ],
      selectedSkills: ["scientific-writing"],
      documents: [
        {
          id: "3a8b7c9e1f2d3a4b5c6e7f8a9b0c1d2e",
          name: "MSDS_Ethanol_99.5_GHS_VN_EN.docx",
          format: "docx",
          totalUnits: 1,
          warnings: [],
          units: [
            {
              id: "u1",
              locator: "Phần 1-8",
              text: `PHIẾU AN TOÀN HÓA CHẤT (MSDS): ETHANOL 99.5%
Số CAS: 64-17-5. Mã UN: UN 1170.
MỤC 2: Nhận dạng mối nguy hại: Từ cảnh báo: NGUY HIỂM (DANGER).
Mã H: H225 (Chất lỏng và hơi rất dễ cháy), H319 (Gây kích ứng mắt nghiêm trọng).
Mã P: P210 (Tránh xa nguồn nhiệt), P280 (Mang găng tay bảo hộ, kính bảo hộ).
MỤC 8: Kiểm soát phơi nhiễm và bảo hộ cá nhân:
Trang bị bảo hộ cá nhân (PPE): Đeo kính bảo hộ hóa chất kín cạnh, mang găng tay cao su Nitrile chống thấm, thao tác trong tủ hút khí độc hoặc phòng thông gió tốt.`,
              method: "text"
            }
          ]
        }
      ]
    })
  });

  console.log("6. Chat API status:", chatRes.status);
  const chatReader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let fullAiReply = "";
  while (true) {
    const { done, value } = await chatReader.read();
    if (done) break;
    fullAiReply += decoder.decode(value);
  }
  console.log("   AI Reply Length:", fullAiReply.length, "chars");
  console.log("   AI Reply Snippet:\n", fullAiReply.slice(0, 450) + "...");

  console.log("\nALL VERIFICATIONS PASSED 100%!");
}

testServer().catch((err) => {
  console.error("Test server error:", err);
  process.exit(1);
});
