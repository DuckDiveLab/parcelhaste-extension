import assert from "node:assert/strict";
import { test } from "node:test";
import { checkImports, importSpecifiers, zoneOf } from "./check-imports.ts";
import { makeRepo, rules } from "./testing.ts";

const CLEAN: Record<string, string> = {
  "src/core/shipment.ts": 'import { z } from "zod";\nexport const S = z.object({});\n',
  "src/carriers/_contract/adapter.ts":
    'import type { S } from "../../core/shipment.ts";\nexport type A = S;\n',
  "src/carriers/_contract/testing.ts": 'import { test } from "node:test";\nexport { test };\n',
  "src/carriers/a/adapter.ts":
    'import type { A } from "../_contract/adapter.ts";\nimport "../../core/shipment.ts";\nimport "./helpers.ts";\n',
  "src/carriers/a/helpers.ts": "export const h = 1;\n",
  "src/carriers/a/adapter.test.ts": 'import "../b/adapter.ts";\nimport "node:fs";\n',
  "src/carriers/b/adapter.ts": 'import "../../core/shipment.ts";\n',
  "src/carriers/index.ts": 'import "./a/adapter.ts";\nimport "./b/adapter.ts";\n',
  "src/inputs/row.ts": 'import "../core/shipment.ts";\nimport "./tsv.ts";\n',
  "src/inputs/tsv.ts": "export const t = 1;\n",
  "src/outputs/label.ts": 'import "../core/shipment.ts";\n',
  "src/ui/panel.ts": 'import "../carriers/index.ts";\nimport "../inputs/row.ts";\n',
  "entrypoints/sidepanel/main.ts": 'import "../../src/ui/panel.ts";\n',
  "scripts/build.ts":
    'import { build } from "esbuild";\nimport "node:fs";\nimport "../src/core/shipment.ts";\n',
};

test("zoneOf classifies files", () => {
  assert.deepEqual(zoneOf("src/core/a.ts"), { kind: "core" });
  assert.deepEqual(zoneOf("src/carriers/_contract/a.ts"), { kind: "contract" });
  assert.deepEqual(zoneOf("src/carriers/cyprus-post/a.ts"), { kind: "carrier", id: "cyprus-post" });
  assert.deepEqual(zoneOf("src/carriers/index.ts"), { kind: "carriers-registry" });
  assert.deepEqual(zoneOf("entrypoints/background.ts"), { kind: "entrypoints" });
  assert.equal(zoneOf("docs/x.ts"), undefined);
});

test("importSpecifiers finds static, side-effect, dynamic, re-export and require forms", () => {
  const content = `import a from "a";\nimport {\n  b,\n} from './b.ts';\nimport "c";\nexport * from "d";\nconst e = await import("e");\nconst f = require("f");\n`;
  assert.deepEqual(importSpecifiers(content).sort(), ["./b.ts", "a", "c", "d", "e", "f"]);
});

test("accepts a layout that respects every boundary", () => {
  assert.deepEqual(checkImports(makeRepo(CLEAN)), []);
});

test("fails when src/core imports outside itself, uses browser globals or Node modules", () => {
  const cases: Record<string, [string, string]> = {
    "core-boundary": ["src/core/a.ts", 'import "../carriers/index.ts";\n'],
    "core-browser-api": ["src/core/a.ts", "export const v = chrome.runtime.id;\n"],
    "browser-node-import": ["src/core/a.ts", 'import "node:fs";\n'],
    "undeclared-runtime-dependency": ["src/core/a.ts", 'import "esbuild";\n'],
  };
  for (const [rule, [file, content]] of Object.entries(cases)) {
    assert.deepEqual(rules(checkImports(makeRepo({ ...CLEAN, [file]: content }))), [rule], rule);
  }
  const bare = makeRepo({ ...CLEAN, "src/core/a.ts": 'import "fs";\n' });
  assert.deepEqual(rules(checkImports(bare)), ["browser-node-import"]);
});

test("fails when a carrier imports another carrier or the registry", () => {
  const sibling = makeRepo({
    ...CLEAN,
    "src/carriers/a/adapter.ts": 'import "../b/adapter.ts";\n',
  });
  assert.deepEqual(rules(checkImports(sibling)), ["carrier-boundary"]);
  const registry = makeRepo({ ...CLEAN, "src/carriers/a/adapter.ts": 'import "../index.ts";\n' });
  assert.deepEqual(rules(checkImports(registry)), ["carrier-boundary"]);
  const contract = makeRepo({
    ...CLEAN,
    "src/carriers/_contract/adapter.ts": 'import "../a/adapter.ts";\n',
  });
  assert.deepEqual(rules(checkImports(contract)), ["contract-boundary"]);
});

test("fails when inputs or outputs import anything but core", () => {
  const inputs = makeRepo({ ...CLEAN, "src/inputs/row.ts": 'import "../carriers/index.ts";\n' });
  assert.deepEqual(rules(checkImports(inputs)), ["inputs-boundary"]);
  const outputs = makeRepo({ ...CLEAN, "src/outputs/label.ts": 'import "../inputs/row.ts";\n' });
  assert.deepEqual(rules(checkImports(outputs)), ["outputs-boundary"]);
});

test("fails when anything imports from entrypoints", () => {
  const fromSrc = makeRepo({
    ...CLEAN,
    "src/ui/panel.ts": 'import "../../entrypoints/background.ts";\n',
  });
  assert.deepEqual(rules(checkImports(fromSrc)), ["entrypoints-imported"]);
  const fromScripts = makeRepo({
    ...CLEAN,
    "scripts/x.ts": 'import "../entrypoints/background.ts";\n',
  });
  assert.deepEqual(rules(checkImports(fromScripts)), ["entrypoints-imported"]);
});

test("fails on bun imports and Bun globals anywhere, tests included", () => {
  const bunColon = `bun:${"test"}`;
  const cases: Record<string, string> = {
    "scripts/x.ts": `import { test } from "${bunColon}";\n`,
    "src/core/x.ts": `export const s = ${"Bu"}n.serve();\n`,
    "src/core/x.test.ts": `import "${"bu"}n";\n`,
    "entrypoints/x.ts": `import { $ } from "${"bu"}n";\n`,
  };
  for (const [file, content] of Object.entries(cases)) {
    assert.deepEqual(
      rules(checkImports(makeRepo({ ...CLEAN, [file]: content }))),
      ["bun-api"],
      file,
    );
  }
});
