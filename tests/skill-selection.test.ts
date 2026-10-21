import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectSkills, selectionState } from "../src/lib/skill-selection";
import { buildSkillContext, contextCharacterBudget, createChatSchema } from "../src/lib/chat-context";
import type { Catalog } from "../src/lib/types";

const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8")) as Catalog;
const ids = catalog.skills.map((s) => s.id);

test("Select all 177, partial selection, group removal and repeated selection keep correct membership", () => {
  const all = selectSkills([ids[0]], ids, true);
  assert.equal(all.length, 177);
  assert.equal(selectionState(all, ids).checked, true);
  assert.deepEqual(selectSkills(all, ids, true), all);
  const chemistry = catalog.skills.filter((s) => s.groupId === "chemistry").map((s) => s.id);
  const remainder = selectSkills(all, chemistry, false);
  assert.equal(remainder.length, 163);
  assert.equal(selectionState(remainder, ids).partial, true);
  assert.equal(selectionState(remainder, chemistry).count, 0);
  assert.equal(selectSkills(remainder, chemistry, true).length, 177);
  assert.deepEqual(selectSkills(all, ids, false), []);
  assert.deepEqual(selectionState(all, []), { checked: false, partial: false, count: 0 });
});

test("API accepts an entire group and all skills, deduplicates and rejects unknown or unsafe IDs", () => {
  const schema = createChatSchema(ids);
  const messages = [{ role: "user", content: "Phân tích nghiên cứu" }];
  assert.equal(schema.parse({ messages, skills: ids }).skills.length, 177);
  assert.equal(schema.parse({ messages, skills: ids.slice(0, 49) }).skills.length, 49);
  assert.deepEqual(schema.parse({ messages, skills: [ids[0], ids[0]] }).skills, [ids[0]]);
  for (const skills of [["not-in-catalog"], ["../SKILL.md"], [...ids, ids[0]]])
    assert.equal(schema.safeParse({ messages, skills }).success, false);
});

test("All selected skills reach AI context within the budget, including the last skill", async () => {
  const seen: string[] = [];
  const context = await buildSkillContext(catalog.skills, async (id) => {
    seen.push(id);
    return "---\nname: " + id + "\n---\n# Instructions\n" + "workflow instruction ".repeat(2000);
  });
  assert.equal(seen.length, 177);
  assert.equal(context.info.selectedCount, 177);
  assert.equal(context.info.includedCount, 177);
  assert.equal(context.info.excerptedCount, 177);
  assert.ok(context.text.length <= 180000);
  assert.equal(context.info.characters, context.text.length);
  for (const id of ids) assert.equal(context.text.split(`SKILL ${id}\n`).length, 2, id);
  assert.ok(context.text.includes("# Instructions"));
});

test("Chat schema validates optional model name", () => {
  const schema = createChatSchema(ids);
  const messages = [{ role: "user" as const, content: "Test" }];
  assert.equal(schema.parse({ messages, skills: [ids[0]], model: "deepseek-v4.1-flash" }).model, "deepseek-v4.1-flash");
  assert.equal(schema.parse({ messages, skills: [ids[0]] }).model, undefined);
});

test("Short documents stay intact, no selection is supported, and read failures cannot silently omit a skill", async () => {
  const doc = "# Exact full document\nAll instructions remain available.";
  const context = await buildSkillContext(catalog.skills.slice(0, 2), async () => doc);
  assert.equal(context.info.excerptedCount, 0);
  assert.equal(context.text.split(doc).length, 3);
  assert.equal((await buildSkillContext([], async () => doc)).info.includedCount, 0);
  await assert.rejects(buildSkillContext(catalog.skills, async (id) => {
    if (id === ids[176]) throw new Error("Missing file");
    return doc;
  }), /Missing file/);
  for (const bad of ["", "NaN", "-1", "10000000"]) assert.equal(contextCharacterBudget(bad), 180000);
  assert.equal(contextCharacterBudget("240000"), 240000);
});
