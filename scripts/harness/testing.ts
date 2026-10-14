// Test helper: builds a throwaway repository on disk for the harness checks.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Violation } from "./types.ts";

const DEFAULTS: Record<string, string> = {
  "package.json": JSON.stringify({
    name: "fixture",
    packageManager: "bun@1.4.3",
    dependencies: { zod: "4.6.5" },
  }),
  "bunfig.toml": "[install]\nminimumReleaseAge = 259200\n",
  "bun.lock": "{}\n",
};

/** Writes `files` (null removes a default) into a fresh temp dir and returns its path. */
export function makeRepo(files: Record<string, string | null> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "harness-"));
  const all: Record<string, string | null> = { ...DEFAULTS, ...files };
  for (const [file, content] of Object.entries(all)) {
    if (content === null) {
      continue;
    }
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  return root;
}

/** Sorted, de-duplicated rule names, for compact assertions. */
export function rules(violations: Violation[]): string[] {
  return [...new Set(violations.map((violation) => violation.rule))].sort();
}

export function lines(count: number, text = "line"): string {
  return `${Array.from({ length: count }, (_, index) => `${text} ${index + 1}`).join("\n")}\n`;
}
