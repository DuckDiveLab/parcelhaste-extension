// Harness layout rules (ADR-0001): AGENTS.md size, CLAUDE.md bridges, skills mirror and format.
import path from "node:path";
import { diffMirror } from "../lib/mirror.ts";
import { countLines, exists, read, walk } from "./files.ts";
import type { Violation } from "./types.ts";

export const AGENTS_MAX_LINES = 120;
export const CLAUDE_MAX_LINES = 15;
export const SKILL_MAX_LINES = 80;
export const SKILLS_SOURCE = ".agents/skills";
export const SKILLS_MIRROR = ".claude/skills";

export function checkAgentsFiles(root: string): Violation[] {
  const violations: Violation[] = [];
  for (const file of walk(root)) {
    const name = path.posix.basename(file);
    const dir = path.posix.dirname(file);
    if (name === "AGENTS.md") {
      const lines = countLines(read(root, file));
      if (lines > AGENTS_MAX_LINES) {
        violations.push({
          rule: "agents-md-length",
          file,
          message: `${lines} lines, the maximum is ${AGENTS_MAX_LINES}`,
        });
      }
      const bridge = path.posix.join(dir, "CLAUDE.md");
      if (!exists(root, bridge)) {
        violations.push({
          rule: "claude-md-missing",
          file,
          message: `no sibling CLAUDE.md bridge (${bridge} must contain "@AGENTS.md")`,
        });
      }
    }
    if (name === "CLAUDE.md") {
      const content = read(root, file);
      const firstLine = content.split(/\r?\n/)[0] ?? "";
      if (firstLine.trim() !== "@AGENTS.md") {
        violations.push({
          rule: "claude-md-bridge",
          file,
          message: 'first line must be exactly "@AGENTS.md"',
        });
      }
      const lines = countLines(content);
      if (lines > CLAUDE_MAX_LINES) {
        violations.push({
          rule: "claude-md-length",
          file,
          message: `${lines} lines, the maximum is ${CLAUDE_MAX_LINES}`,
        });
      }
    }
  }
  return violations;
}

export function checkSkillsMirror(root: string): Violation[] {
  const diffs = diffMirror(path.join(root, SKILLS_SOURCE), path.join(root, SKILLS_MIRROR));
  return diffs.map((diff) => ({
    rule: "skills-mirror",
    file: `${SKILLS_MIRROR}/${diff.path}`,
    message: `${diff.kind} compared to ${SKILLS_SOURCE}; run \`bun run harness:sync\``,
  }));
}

export function checkSkillFormat(root: string): Violation[] {
  const violations: Violation[] = [];
  for (const file of walk(root, SKILLS_SOURCE)) {
    if (path.posix.basename(file) !== "SKILL.md") {
      continue;
    }
    const content = read(root, file);
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1];
    const dirName = path.posix.basename(path.posix.dirname(file));
    const name = frontmatter === undefined ? undefined : /^name:\s*(\S+)/m.exec(frontmatter)?.[1];
    const hasDescription = frontmatter !== undefined && /^description:\s*\S/m.test(frontmatter);
    if (frontmatter === undefined || name === undefined || !hasDescription) {
      violations.push({
        rule: "skill-frontmatter",
        file,
        message: "must start with frontmatter containing `name` and `description`",
      });
    } else if (name !== dirName) {
      violations.push({
        rule: "skill-frontmatter",
        file,
        message: `frontmatter name "${name}" must equal the directory name "${dirName}"`,
      });
    }
    const lines = countLines(content);
    if (lines > SKILL_MAX_LINES) {
      violations.push({
        rule: "skill-length",
        file,
        message: `${lines} lines, the maximum is ${SKILL_MAX_LINES}`,
      });
    }
  }
  return violations;
}
