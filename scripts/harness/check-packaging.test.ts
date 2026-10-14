import assert from "node:assert/strict";
import { test } from "node:test";
import { checkBunfig, checkLockfiles, checkPackageManager } from "./check-packaging.ts";
import { makeRepo, rules } from "./testing.ts";

test("accepts the default fixture repository", () => {
  const root = makeRepo();
  assert.deepEqual(checkLockfiles(root), []);
  assert.deepEqual(checkBunfig(root), []);
  assert.deepEqual(checkPackageManager(root), []);
});

test("fails on every foreign or binary lockfile, anywhere in the tree", () => {
  const names = [
    "package-lock.json",
    "npm-shrinkwrap.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
  ];
  for (const name of names) {
    const root = makeRepo({ [`packages/x/${name}`]: "" });
    const violations = checkLockfiles(root);
    assert.deepEqual(rules(violations), ["foreign-lockfile"], name);
    assert.equal(violations[0]?.file, `packages/x/${name}`);
  }
});

test("fails when bun.lock is missing", () => {
  assert.deepEqual(rules(checkLockfiles(makeRepo({ "bun.lock": null }))), ["lockfile-missing"]);
});

test("fails when bunfig.toml is missing or lacks a positive minimumReleaseAge", () => {
  const cases = {
    missing: null,
    noKey: "[install]\nexact = true\n",
    zero: "[install]\nminimumReleaseAge = 0\n",
  };
  for (const [name, content] of Object.entries(cases)) {
    const root = makeRepo({ "bunfig.toml": content });
    assert.deepEqual(rules(checkBunfig(root)), ["bunfig-minimum-release-age"], name);
  }
});

test("fails unless packageManager is a pinned bun@x.y.z", () => {
  for (const value of [undefined, "bun", "bun@1", "bun@latest", "pnpm@9.0.0", "bun@1.4.3-canary"]) {
    const root = makeRepo({ "package.json": JSON.stringify({ packageManager: value }) });
    assert.deepEqual(rules(checkPackageManager(root)), ["package-manager-pin"], String(value));
  }
  assert.deepEqual(checkPackageManager(makeRepo()), []);
});
