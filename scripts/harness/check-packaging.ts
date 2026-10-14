// Supply-chain rules (ADR-0007): only bun.lock, cooldown configured, bun version pinned.
import path from "node:path";
import { exists, read, walk } from "./files.ts";
import type { Violation } from "./types.ts";

export const FOREIGN_LOCKFILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
]);

export function checkLockfiles(root: string): Violation[] {
  const violations: Violation[] = [];
  for (const file of walk(root)) {
    if (FOREIGN_LOCKFILES.has(path.posix.basename(file))) {
      violations.push({
        rule: "foreign-lockfile",
        file,
        message:
          "only the text lockfile bun.lock is allowed; delete this file and run `bun install`",
      });
    }
  }
  if (!exists(root, "bun.lock")) {
    violations.push({ rule: "lockfile-missing", file: "bun.lock", message: "run `bun install`" });
  }
  return violations;
}

export function checkBunfig(root: string): Violation[] {
  if (!exists(root, "bunfig.toml")) {
    return [
      { rule: "bunfig-minimum-release-age", file: "bunfig.toml", message: "file is missing" },
    ];
  }
  const match = /^\s*minimumReleaseAge\s*=\s*(\d+)/m.exec(read(root, "bunfig.toml"));
  if (match?.[1] === undefined || Number(match[1]) <= 0) {
    return [
      {
        rule: "bunfig-minimum-release-age",
        file: "bunfig.toml",
        message: "must set [install] minimumReleaseAge to a positive number of seconds",
      },
    ];
  }
  return [];
}

export function checkPackageManager(root: string): Violation[] {
  const pkg = JSON.parse(read(root, "package.json")) as { packageManager?: unknown };
  const value = typeof pkg.packageManager === "string" ? pkg.packageManager : "";
  if (!/^bun@\d+\.\d+\.\d+$/.test(value)) {
    return [
      {
        rule: "package-manager-pin",
        file: "package.json",
        message: `packageManager must be a pinned "bun@x.y.z", got "${value}"`,
      },
    ];
  }
  return [];
}
