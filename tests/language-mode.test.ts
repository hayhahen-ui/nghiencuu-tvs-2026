import test from "node:test";
import assert from "node:assert/strict";
import { createChatSchema } from "../src/lib/chat-context";

test("Chat schema validates language modes with default Vietnamese", () => {
  const schema = createChatSchema([]);
  const basePayload = {
    messages: [{ role: "user" as const, content: "Kiểm tra ngôn ngữ" }],
  };

  // Default is 'vi'
  const defaultParsed = schema.parse(basePayload);
  assert.equal(defaultParsed.language, "vi", "Default language must be 'vi'");

  // Explicit 'vi'
  const viParsed = schema.parse({ ...basePayload, language: "vi" });
  assert.equal(viParsed.language, "vi");

  // Explicit 'en'
  const enParsed = schema.parse({ ...basePayload, language: "en" });
  assert.equal(enParsed.language, "en");

  // Explicit 'zh'
  const zhParsed = schema.parse({ ...basePayload, language: "zh" });
  assert.equal(zhParsed.language, "zh");

  // Rejects invalid languages
  assert.throws(() => {
    schema.parse({ ...basePayload, language: "fr" });
  });
});
