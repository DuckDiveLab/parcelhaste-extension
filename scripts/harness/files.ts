import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SKIPPED_DIRS = new Set(["node_modules", "dist", ".git"]);

/** Every file under `root` (repo-relative, forward slashes), skipping build and VCS dirs. */
export function walk(root: string, subdir = "."): string[] {
  const start = path.join(root, subdir);
  if (!existsSync(start)) {
    return [];
  }
  const files: string[] = [];
  const entries = readdirSync(start, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = toPosix(path.relative(root, absolute));
    if (relative.split("/").some((segment) => SKIPPED_DIRS.has(segment))) {
      continue;
    }
    files.push(relative);
  }
  return files.sort();
}

export function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}

export function read(root: string, file: string): string {
  return readFileSync(path.join(root, file), "utf8");
}

export function exists(root: string, file: string): boolean {
  return existsSync(path.join(root, file));
}

/** Number of lines, ignoring the final newline. */
export function countLines(content: string): number {
  if (content === "") {
    return 0;
  }
  return content.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

export function isTestFile(file: string): boolean {
  return /(^|\/)(?:[^/]+\.test\.ts|testing\.ts)$/.test(file);
}
