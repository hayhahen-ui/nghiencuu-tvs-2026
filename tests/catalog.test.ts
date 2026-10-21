import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
test("All archive files are preserved byte for byte and every skill is discoverable", async () => {
  const manifest = JSON.parse(
    await readFile("audit/manifest.json", "utf8"),
  ) as { path: string; size: number; sha256: string }[];
  const files = JSON.parse(
    await readFile("public/files.json", "utf8"),
  ) as string[];
  const catalog = JSON.parse(await readFile("data/catalog.json", "utf8")) as {
    skills: { id: string; files: string[] }[];
    fileCount: number;
  };
  assert.equal(manifest.length, 2780);
  assert.equal(files.length, manifest.length);
  assert.equal(new Set(files).size, manifest.length);
  assert.equal(catalog.skills.length, 177);
  assert.equal(catalog.fileCount, manifest.length);
  const concurrency = 32;
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, manifest.length) }, async () => {
      while (idx < manifest.length) {
        const entry = manifest[idx++];
        assert.ok(files.includes(entry.path), entry.path);
        const bytes = await readFile(
          path.join("vendor/scientific-agent-skills", entry.path),
        );
        assert.equal(bytes.length, entry.size, entry.path);
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          entry.sha256,
          entry.path,
        );
        const publicBytes = await readFile(path.join("public/library", entry.path));
        assert.equal(
          createHash("sha256").update(publicBytes).digest("hex"),
          entry.sha256,
          entry.path,
        );
      }
    }),
  );
  for (const skill of catalog.skills)
    assert.ok(skill.files.includes(`skills/${skill.id}/SKILL.md`));
});
