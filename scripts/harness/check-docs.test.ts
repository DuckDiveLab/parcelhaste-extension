import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAgentsFiles, checkSkillFormat, checkSkillsMirror } from "./check-docs.ts";
import { lines, makeRepo, rules } from "./testing.ts";

const SKILL = "---\nname: spec\ndescription: Write a spec.\n---\n\n# Spec\n";

test("accepts AGENTS.md within 120 lines with a CLAUDE.md bridge", () => {
  const root = makeRepo({ "AGENTS.md": lines(120), "CLAUDE.md": "@AGENTS.md\n" });
  assert.deepEqual(checkAgentsFiles(root), []);
});

test("fails when AGENTS.md is over 120 lines", () => {
  const root = makeRepo({ "AGENTS.md": lines(121), "CLAUDE.md": "@AGENTS.md\n" });
  assert.deepEqual(rules(checkAgentsFiles(root)), ["agents-md-length"]);
});

test("fails when an AGENTS.md has no sibling CLAUDE.md, at any depth", () => {
  const root = makeRepo({
    "AGENTS.md": lines(3),
    "CLAUDE.md": "@AGENTS.md\n",
    "src/carriers/AGENTS.md": lines(3),
  });
  const violations = checkAgentsFiles(root);
  assert.deepEqual(rules(violations), ["claude-md-missing"]);
  assert.equal(violations[0]?.file, "src/carriers/AGENTS.md");
});

test("fails when CLAUDE.md does not start with @AGENTS.md or is over 15 lines", () => {
  const bridge = makeRepo({ "AGENTS.md": lines(3), "CLAUDE.md": "# Notes\n@AGENTS.md\n" });
  assert.deepEqual(rules(checkAgentsFiles(bridge)), ["claude-md-bridge"]);
  const long = makeRepo({ "AGENTS.md": lines(3), "CLAUDE.md": `@AGENTS.md\n${lines(15)}` });
  assert.deepEqual(rules(checkAgentsFiles(long)), ["claude-md-length"]);
});

test("fails when .claude/skills differs from .agents/skills", () => {
  const stale = makeRepo({
    ".agents/skills/spec/SKILL.md": SKILL,
    ".claude/skills/spec/SKILL.md": "old",
  });
  assert.deepEqual(rules(checkSkillsMirror(stale)), ["skills-mirror"]);
  const missing = makeRepo({ ".agents/skills/spec/SKILL.md": SKILL });
  assert.deepEqual(rules(checkSkillsMirror(missing)), ["skills-mirror"]);
  const synced = makeRepo({
    ".agents/skills/spec/SKILL.md": SKILL,
    ".claude/skills/spec/SKILL.md": SKILL,
  });
  assert.deepEqual(checkSkillsMirror(synced), []);
});

test("fails when a skill lacks frontmatter, has the wrong name, or is over 80 lines", () => {
  assert.deepEqual(checkSkillFormat(makeRepo({ ".agents/skills/spec/SKILL.md": SKILL })), []);
  const noFrontmatter = makeRepo({ ".agents/skills/spec/SKILL.md": "# Spec\n" });
  assert.deepEqual(rules(checkSkillFormat(noFrontmatter)), ["skill-frontmatter"]);
  const wrongName = makeRepo({ ".agents/skills/build/SKILL.md": SKILL });
  assert.deepEqual(rules(checkSkillFormat(wrongName)), ["skill-frontmatter"]);
  const long = makeRepo({ ".agents/skills/spec/SKILL.md": SKILL + lines(75) });
  assert.deepEqual(rules(checkSkillFormat(long)), ["skill-length"]);
});
