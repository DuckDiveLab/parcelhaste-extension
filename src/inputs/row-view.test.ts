import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseRows } from "./row.ts";
import { rowViewModel } from "./row-view.ts";

const fixture = readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/rows/make-label.tsv"),
  "utf8",
);
const lines = fixture.split("\n").filter((line) => line !== "");
const [HEADER = "", DE_ROW = "", GB_ROW = ""] = lines;

test("AC-002-15 exactly one parsed row yields a summary and canCreate; none or several yield the report", () => {
  const ok = rowViewModel(parseRows(`${HEADER}\n${GB_ROW}\n`));
  assert.equal(ok.canCreate, true);
  assert.deepEqual(ok.summary, {
    recipientName: "Second Tester",
    countryCode: "GB",
    weightGrams: 214,
    itemCount: 3,
  });

  const failed = rowViewModel(parseRows(`${HEADER}\n${DE_ROW.replace("0.012", "heavy")}\n`));
  assert.equal(failed.canCreate, false);
  assert.equal(failed.summary, undefined);
  assert.ok(failed.issues.some((issue) => issue.code === "weight-invalid"));

  const several = rowViewModel(parseRows(`${HEADER}\n${DE_ROW}\n${GB_ROW}\n`));
  assert.equal(several.canCreate, false);
  assert.equal(several.issues[0]?.code, "one-row-per-paste");

  assert.equal(rowViewModel(parseRows("")).canCreate, false);
});
