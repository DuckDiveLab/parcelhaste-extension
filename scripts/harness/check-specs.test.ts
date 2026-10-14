import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSpecs, parseFrontmatter } from "./check-specs.ts";
import { makeRepo, rules } from "./testing.ts";

function spec(
  status: string,
  body = "- **AC-001-1** The system shall parse.\n",
  extra = "",
): string {
  return `---\nid: "001"\ntitle: Shipment model\nstatus: ${status}\n${extra}---\n\n${body}`;
}

test("parseFrontmatter reads key: value pairs and strips quotes", () => {
  assert.deepEqual(parseFrontmatter('---\nid: "001"\ntitle: X y\n---\nbody'), {
    id: "001",
    title: "X y",
  });
  assert.equal(parseFrontmatter("# no frontmatter"), undefined);
});

test("accepts a draft spec with untested criteria and ignores the README", () => {
  const root = makeRepo({
    "docs/specs/001-shipment-model.md": spec("draft"),
    "docs/specs/README.md": "# Index\n",
  });
  assert.deepEqual(checkSpecs(root), []);
});

test("fails on missing or invalid frontmatter fields", () => {
  const cases: Record<string, string> = {
    missing: "# Spec without frontmatter\n",
    badStatus: spec("done"),
    badId: spec("draft").replace('id: "001"', 'id: "002"'),
    noTitle: spec("draft").replace("title: Shipment model\n", ""),
    badCarrier: spec("draft", "", "carrier: Cyprus Post\n"),
  };
  for (const [name, content] of Object.entries(cases)) {
    const root = makeRepo({ "docs/specs/001-shipment-model.md": content });
    assert.deepEqual(rules(checkSpecs(root)), ["spec-frontmatter"], name);
  }
});

test("fails on a spec filename that is not NNN-slug.md", () => {
  const root = makeRepo({ "docs/specs/1-shipment.md": spec("draft") });
  assert.deepEqual(rules(checkSpecs(root)), ["spec-filename"]);
});

test("fails when a spec lists a criterion of another spec", () => {
  const root = makeRepo({
    "docs/specs/001-shipment-model.md": spec("draft", "- **AC-002-1** x\n"),
  });
  assert.deepEqual(rules(checkSpecs(root)), ["spec-ac-id"]);
});

test("fails when an approved or implemented criterion has no test mentioning it", () => {
  for (const status of ["approved", "implemented"]) {
    const untested = makeRepo({ "docs/specs/001-shipment-model.md": spec(status) });
    assert.deepEqual(rules(checkSpecs(untested)), ["spec-ac-untested"], status);
    const tested = makeRepo({
      "docs/specs/001-shipment-model.md": spec(status),
      "src/core/shipment.test.ts": 'test("AC-001-1 parses", () => {});\n',
    });
    assert.deepEqual(checkSpecs(tested), [], status);
  }
});

test("fails when a test references a criterion that no spec defines", () => {
  const root = makeRepo({
    "docs/specs/001-shipment-model.md": spec("draft"),
    "scripts/lib/x.test.ts": 'test("AC-009-3 nothing", () => {});\n',
  });
  const violations = checkSpecs(root);
  assert.deepEqual(rules(violations), ["test-ac-unknown"]);
  assert.equal(violations[0]?.file, "scripts/lib/x.test.ts");
});
