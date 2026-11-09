import test from "node:test";
import assert from "node:assert/strict";
import { exportSessionToMarkdown, type ChatSession } from "../src/lib/chat-history-store";

test("Chat session exports to detailed Markdown with metadata and timestamps", () => {
  const session: ChatSession = {
    id: "session-test-01",
    title: "Đề xuất thay đổi công thức chất vệ sinh trước công đoạn phun",
    createdAt: "2026-10-21T03:52:00.000Z",
    updatedAt: "2026-10-21T03:52:45.000Z",
    model: "deepseek-v4.1-flash",
    language: "vi",
    documentNames: ["124.297-SDS-VN_20260130.pdf", "111.289-SDS-VN.pdf"],
    messages: [
      {
        role: "user",
        content: "Hiện trạng đang sử dụng 3 chất pha với nhau...",
        timestamp: "2026-10-21T03:52:00.000Z",
      },
      {
        role: "assistant",
        content: "Phân tích phương án thay đổi: Sử dụng 297 ở 100%...",
        timestamp: "2026-10-21T03:52:45.000Z",
      },
    ],
  };

  const md = exportSessionToMarkdown(session);
  assert.ok(md.includes("Đề xuất thay đổi công thức"), "Markdown should have title");
  assert.ok(md.includes("deepseek-v4.1-flash"), "Markdown should include model name");
  assert.ok(md.includes("Tiếng Việt"), "Markdown should include language");
  assert.ok(md.includes("124.297-SDS-VN_20260130.pdf"), "Markdown should include cited documents");
  assert.ok(md.includes("Hiện trạng đang sử dụng"), "Markdown should include user question");
  assert.ok(md.includes("Phân tích phương án thay đổi"), "Markdown should include assistant reply");
});
