import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { runAllChecks } from "./index.ts";
import { makeRepo } from "./testing.ts";

test("runAllChecks passes on a minimal valid repository", () => {
  assert.deepEqual(
    runAllChecks(makeRepo({ "AGENTS.md": "# Rules\n", "CLAUDE.md": "@AGENTS.md\n" })),
    [],
  );
});

test("the harness-check CLI exits 1 and names the rule on a violation", () => {
  const root = makeRepo({ "AGENTS.md": "# Rules\n" });
  const cli = path.resolve(import.meta.dirname, "../harness-check.ts");
  const result = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /claude-md-missing/);
});

test("the harness-check CLI exits 0 on a clean repository", () => {
  const root = makeRepo({ "AGENTS.md": "# Rules\n", "CLAUDE.md": "@AGENTS.md\n" });
  const cli = path.resolve(import.meta.dirname, "../harness-check.ts");
  const result = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /harness-check: ok/);
});
