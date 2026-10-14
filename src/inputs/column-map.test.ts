import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { EXPORT_COLUMNS, isHeaderRow, toExportRow } from "./column-map.ts";

const fixture = readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/rows/cyprus-post-export.tsv"),
  "utf8",
);
const [headerLine = "", firstRow = ""] = fixture.split("\n");

test("AC-002-14 the column map is the export header, in order, and the only source of positions", () => {
  assert.deepEqual([...EXPORT_COLUMNS], headerLine.split("\t"));
  assert.equal(EXPORT_COLUMNS.length, 22);
  assert.equal(isHeaderRow(headerLine.split("\t")), true);
  assert.equal(isHeaderRow(firstRow.split("\t")), false);

  const row = toExportRow(firstRow.split("\t"));
  assert.equal(row["order-id"], "TEST-ORDER-0001");
  assert.equal(row["ship-country-code"], "DE");
  assert.equal(row["Package weight"], "250");
  assert.throws(() => toExportRow(["only", "three", "cells"]), /22/);
});
