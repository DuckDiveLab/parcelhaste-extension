// The harness gate: fails when the repository drifts from AGENTS.md's rules.
// Rules live in scripts/harness/*.ts, each with tests proving it fails on its violation.
import path from "node:path";
import { CHECKS, runAllChecks } from "./harness/index.ts";

// An optional root argument lets tests run the gate against a fixture repository.
const rootArg = process.argv[2];
const repoRoot =
  rootArg === undefined ? path.resolve(import.meta.dirname, "..") : path.resolve(rootArg);
const violations = runAllChecks(repoRoot);

if (violations.length === 0) {
  console.log(`harness-check: ok (${CHECKS.length} checks)`);
} else {
  for (const violation of violations) {
    console.error(`${violation.file}: ${violation.message} [${violation.rule}]`);
  }
  console.error(`\nharness-check: ${violations.length} violation(s)`);
  process.exitCode = 1;
}
