// Usage:
//   node scripts/commitlint.ts <message-file>      (git commit-msg hook)
//   node scripts/commitlint.ts --range <a>..<b>    (CI: every commit in the range)
//   node scripts/commitlint.ts --message "<text>"
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { lintCommitMessage } from "./lib/commit-message.ts";

function commitsInRange(range: string): { sha: string; message: string }[] {
  const raw = execFileSync("git", ["log", "--format=%H%x00%B%x1e", range], { encoding: "utf8" });
  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .map((entry) => {
      const [sha = "", message = ""] = entry.split("\x00");
      return { sha, message };
    });
}

function main(args: string[]): number {
  const [mode, value] = args;
  const targets: { label: string; message: string }[] = [];
  if (mode === "--range" && value !== undefined) {
    for (const commit of commitsInRange(value)) {
      targets.push({ label: commit.sha.slice(0, 10), message: commit.message });
    }
  } else if (mode === "--message" && value !== undefined) {
    targets.push({ label: "message", message: value });
  } else if (mode !== undefined && !mode.startsWith("--")) {
    targets.push({ label: mode, message: readFileSync(mode, "utf8") });
  } else {
    console.error("usage: commitlint <file> | --range <a>..<b> | --message <text>");
    return 2;
  }

  let failed = false;
  for (const target of targets) {
    const problems = lintCommitMessage(target.message);
    if (problems.length > 0) {
      failed = true;
      console.error(`${target.label}: ${target.message.split("\n")[0]}`);
      for (const problem of problems) {
        console.error(`  - ${problem}`);
      }
    }
  }
  if (failed) {
    console.error("\nSee https://www.conventionalcommits.org/ — format: type(scope)?: subject");
  }
  return failed ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
