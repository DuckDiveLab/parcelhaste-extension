import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseExportRows } from "./row.ts";
import { rowViewModel } from "./row-view.ts";

const fixture = readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/rows/cyprus-post-export.tsv"),
  "utf8",
);
const lines = fixture.split("\n").filter((line) => line !== "");

test("AC-002-15 a parsed shipment yields a summary and canCreate, a failure yields the report", () => {
  const ok = rowViewModel(parseExportRows(`${lines[2]}\n${lines[3]}`));
  assert.equal(ok.canCreate, true);
  assert.deepEqual(ok.summary, {
    recipientName: "Second Tester",
    countryCode: "GB",
    weightGrams: 600,
    itemCount: 3,
  });

  const failed = rowViewModel(parseExportRows(lines[4] ?? ""));
  assert.equal(failed.canCreate, false);
  assert.equal(failed.summary, undefined);
  assert.deepEqual(
    failed.issues.map((issue) => issue.code),
    ["weight-required"],
  );

  const empty = rowViewModel(parseExportRows(""));
  assert.equal(empty.canCreate, false);
});
