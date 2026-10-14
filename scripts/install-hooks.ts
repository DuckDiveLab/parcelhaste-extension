// Points git at the versioned hooks in .githooks/. Runs from the `prepare`
// script on every `bun install`; a no-op outside a git checkout and in CI.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

if (process.env["CI"] === undefined && existsSync(path.join(repoRoot, ".git"))) {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}
