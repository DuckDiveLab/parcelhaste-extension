// Regenerates .claude/skills/ from .agents/skills/. Never edit the mirror by hand.
import path from "node:path";
import { syncMirror } from "./lib/mirror.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");
const applied = syncMirror(
  path.join(repoRoot, ".agents/skills"),
  path.join(repoRoot, ".claude/skills"),
);

if (applied.length === 0) {
  console.log(".claude/skills is in sync with .agents/skills");
} else {
  for (const diff of applied) {
    console.log(`${diff.kind.padEnd(9)} .claude/skills/${diff.path}`);
  }
}
