import assert from "node:assert/strict";
import { test } from "node:test";
import { lintCommitMessage } from "./commit-message.ts";

test("accepts a plain conventional header", () => {
  assert.deepEqual(lintCommitMessage("feat: add clipboard row parser"), []);
});

test("accepts scope, breaking marker, body and comment lines", () => {
  const message = "fix(core)!: reject rows without a postcode\n\nBody.\n# comment\n";
  assert.deepEqual(lintCommitMessage(message), []);
});

test("accepts merge, revert, fixup and squash commits", () => {
  assert.deepEqual(lintCommitMessage("Merge branch 'main' into x"), []);
  assert.deepEqual(lintCommitMessage('Revert "feat: x"'), []);
  assert.deepEqual(lintCommitMessage("fixup! feat: x"), []);
});

test("rejects an empty message", () => {
  assert.deepEqual(lintCommitMessage("\n# only comments\n"), ["commit message is empty"]);
});

test("rejects a header without a type", () => {
  const problems = lintCommitMessage("Added stuff");
  assert.equal(problems.length, 1);
  assert.match(problems[0] ?? "", /Conventional Commits/);
});

test("rejects an unknown type", () => {
  assert.match(lintCommitMessage("feature: x")[0] ?? "", /not one of/);
});

test("rejects a long header, trailing period and uppercase subject", () => {
  const long = `feat: ${"x".repeat(100)}`;
  assert.match(lintCommitMessage(long)[0] ?? "", /maximum is 100/);
  assert.match(lintCommitMessage("feat: ends with period.")[0] ?? "", /period/);
  assert.match(lintCommitMessage("feat: Uppercase")[0] ?? "", /uppercase/);
});

test("rejects a body that is not separated by a blank line", () => {
  assert.match(lintCommitMessage("feat: x\nbody")[0] ?? "", /must be blank/);
});
