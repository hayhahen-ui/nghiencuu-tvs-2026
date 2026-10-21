import { z } from "zod";

export function createChatSchema(knownIds: string[]) {
  const known = new Set(knownIds);
  return z.object({
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(12000),
    })).min(1).max(20),
    skills: z.array(z.string().regex(/^[a-z0-9-]+$/).refine((id) => known.has(id)))
      .max(known.size).default([]).transform((ids) => [...new Set(ids)]),
    model: z.string().max(100).optional(),
  });
}

type ContextSkill = { id: string; title: string; description: string; category: string };
export type SkillContextInfo = {
  selectedCount: number;
  includedCount: number;
  excerptedCount: number;
  characters: number;
};

export function contextCharacterBudget(value = process.env.AI_CONTEXT_MAX_CHARS) {
  const budget = Number(value);
  return Number.isFinite(budget) && budget >= 64000 && budget <= 800000
    ? Math.floor(budget) : 180000;
}

// Give every chosen skill space. Never silently drop all but the first few IDs.
export async function buildSkillContext(
  skills: ContextSkill[],
  load: (id: string) => Promise<string>,
  budget = contextCharacterBudget(),
) {
  if (!skills.length) return {
    text: "", info: { selectedCount: 0, includedCount: 0, excerptedCount: 0, characters: 0 },
  };
  const separator = "\n\n";
  const available = budget - separator.length * (skills.length - 1);
  const perSkill = Math.floor(available / skills.length);
  const documents = await Promise.all(skills.map(async (skill) => {
    const original = await load(skill.id);
    const full = `SKILL ${skill.id}\n${original}`;
    const header = `SKILL ${skill.id}\n${skill.title.slice(0, 140)} · ${skill.category}\n`;
    if (full.length <= perSkill) return { text: full, excerpted: false };
    const note = "\n[Trích gọn SKILL.md; các file tham khảo chưa được nạp.]";
    const room = perSkill - header.length - note.length;
    if (room < 80) throw new Error("Insufficient context budget for all selected skills");
    const summary = skill.description.slice(0, Math.min(450, Math.floor(room * .45)));
    // Skip duplicate YAML metadata so the excerpt also contains working instructions.
    const body = original.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
    const text = header + summary + "\n" + body.slice(0, room - summary.length - 1) + note;
    return { text, excerpted: true };
  }));
  const text = documents.map((doc) => doc.text).join(separator);
  return {
    text,
    info: {
      selectedCount: skills.length,
      includedCount: documents.length,
      excerptedCount: documents.filter((doc) => doc.excerpted).length,
      characters: text.length,
    },
  };
}
