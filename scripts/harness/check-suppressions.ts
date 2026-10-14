// Every lint or type suppression needs a reason; blanket suppressions are banned.
import path from "node:path";
import { read, walk } from "./files.ts";
import type { Violation } from "./types.ts";

const CODE_DIRS = ["src", "scripts", "entrypoints", "tests"];
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

interface Pattern {
  regex: RegExp;
  valid?: RegExp;
  message: string;
}

const PATTERNS: Pattern[] = [
  {
    regex: /biome-ignore(?:-all|-start)?\b.*/,
    valid: /biome-ignore(?:-all|-start)?\s+[\w/-]+(?:\([^)]*\))?\s*:\s*\S/,
    message: "biome-ignore needs a rule and a reason: `// biome-ignore lint/<group>/<rule>: why`",
  },
  {
    regex: /@ts-expect-error\b.*/,
    valid: /@ts-expect-error\s+\S/,
    message: "@ts-expect-error needs a reason after it",
  },
  { regex: /@ts-ignore\b/, message: "use @ts-expect-error with a reason instead of @ts-ignore" },
  { regex: /@ts-nocheck\b/, message: "@ts-nocheck is not allowed" },
  { regex: /eslint-disable/, message: "eslint comments are meaningless here; Biome is the linter" },
];

/** Files that legitimately contain the markers as data: this scanner and its test. */
const SELF = /^scripts\/harness\/check-suppressions(\.test)?\.ts$/;

export function checkSuppressions(root: string): Violation[] {
  const violations: Violation[] = [];
  for (const dir of CODE_DIRS) {
    for (const file of walk(root, dir)) {
      if (!CODE_EXTENSIONS.has(path.posix.extname(file)) || SELF.test(file)) {
        continue;
      }
      const lines = read(root, file).split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const pattern of PATTERNS) {
          const hit = pattern.regex.exec(line);
          if (hit === null || pattern.valid?.test(hit[0]) === true) {
            continue;
          }
          violations.push({
            rule: "suppression-without-reason",
            file: `${file}:${index + 1}`,
            message: pattern.message,
          });
        }
      });
    }
  }
  return violations;
}
