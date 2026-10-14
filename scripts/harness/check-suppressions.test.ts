import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSuppressions } from "./check-suppressions.ts";
import { makeRepo, rules } from "./testing.ts";

// Built at runtime so this file never contains the banned markers itself.
const BIOME = `biome-${"ignore"}`;
const TS = "@ts-";

test("accepts suppressions that carry a reason", () => {
  const root = makeRepo({
    "src/core/a.ts": `// ${BIOME} lint/suspicious/noExplicitAny: third-party shape\nconst a: any = 1;\n// ${TS}expect-error testing a wrong call on purpose\nf(1);\n`,
    "scripts/x.ts": `// ${BIOME}-all lint/style/noDefaultExport: config file\n`,
  });
  assert.deepEqual(checkSuppressions(root), []);
});

test("fails on suppressions without a reason and on blanket suppressions", () => {
  const cases = [
    `// ${BIOME} lint/suspicious/noExplicitAny\nconst a: any = 1;\n`,
    `// ${BIOME} lint/suspicious/noExplicitAny:\n`,
    `// ${TS}expect-error\nf(1);\n`,
    `// ${TS}ignore\nf(1);\n`,
    `// ${TS}nocheck\n`,
    `/* eslint-${"disable"} */\n`,
  ];
  for (const content of cases) {
    const root = makeRepo({ "src/core/a.ts": content });
    const violations = checkSuppressions(root);
    assert.deepEqual(rules(violations), ["suppression-without-reason"], content);
    assert.match(violations[0]?.file ?? "", /^src\/core\/a\.ts:\d+$/);
  }
});

test("only scans code files in code directories", () => {
  const root = makeRepo({
    "docs/x.md": `// ${TS}ignore\n`,
    "src/core/notes.md": `// ${TS}ignore\n`,
  });
  assert.deepEqual(checkSuppressions(root), []);
});
