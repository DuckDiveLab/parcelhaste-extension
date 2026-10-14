// Keeps .claude/skills/ an exact copy of .agents/skills/ (ADR-0001).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

export interface MirrorDiff {
  path: string;
  kind: "missing" | "extra" | "different";
}

/** Relative paths of every file under `dir`, sorted, using forward slashes. */
export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
    )
    .sort();
}

/** Differences between a source tree and its mirror. Empty means in sync. */
export function diffMirror(sourceDir: string, targetDir: string): MirrorDiff[] {
  const source = listFiles(sourceDir);
  const target = new Set(listFiles(targetDir));
  const diffs: MirrorDiff[] = [];
  for (const file of source) {
    if (!target.has(file)) {
      diffs.push({ path: file, kind: "missing" });
      continue;
    }
    target.delete(file);
    const a = readFileSync(path.join(sourceDir, file));
    const b = readFileSync(path.join(targetDir, file));
    if (!a.equals(b)) {
      diffs.push({ path: file, kind: "different" });
    }
  }
  for (const file of target) {
    diffs.push({ path: file, kind: "extra" });
  }
  return diffs;
}

/** Makes `targetDir` an exact copy of `sourceDir`. Returns the applied diffs. */
export function syncMirror(sourceDir: string, targetDir: string): MirrorDiff[] {
  const diffs = diffMirror(sourceDir, targetDir);
  for (const diff of diffs) {
    const target = path.join(targetDir, diff.path);
    if (diff.kind === "extra") {
      rmSync(target);
    } else {
      mkdirSync(path.dirname(target), { recursive: true });
      cpSync(path.join(sourceDir, diff.path), target);
    }
  }
  return diffs;
}
