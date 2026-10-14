import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { diffMirror, listFiles, syncMirror } from "./mirror.ts";

function tree(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "mirror-"));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

test("listFiles returns sorted relative paths and [] for a missing dir", () => {
  const dir = tree({ "b/SKILL.md": "b", "a/SKILL.md": "a" });
  assert.deepEqual(listFiles(dir), ["a/SKILL.md", "b/SKILL.md"]);
  assert.deepEqual(listFiles(path.join(dir, "nope")), []);
});

test("diffMirror reports missing, extra and different files", () => {
  const source = tree({ "spec/SKILL.md": "v2", "build/SKILL.md": "same" });
  const target = tree({ "spec/SKILL.md": "v1", "build/SKILL.md": "same", "old/SKILL.md": "x" });
  assert.deepEqual(diffMirror(source, target), [
    { path: "spec/SKILL.md", kind: "different" },
    { path: "old/SKILL.md", kind: "extra" },
  ]);
  assert.deepEqual(diffMirror(source, path.join(target, "none")), [
    { path: "build/SKILL.md", kind: "missing" },
    { path: "spec/SKILL.md", kind: "missing" },
  ]);
});

test("syncMirror makes the target identical", () => {
  const source = tree({ "spec/SKILL.md": "v2", "new/SKILL.md": "n" });
  const target = tree({ "spec/SKILL.md": "v1", "old/SKILL.md": "x" });
  const applied = syncMirror(source, target);
  assert.equal(applied.length, 3);
  assert.deepEqual(diffMirror(source, target), []);
  assert.equal(readFileSync(path.join(target, "spec/SKILL.md"), "utf8"), "v2");
});
