import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { isHeader, ROW_FIELDS, readHeader, toRecord } from "./column-map.ts";

const fixture = readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/rows/make-label.tsv"),
  "utf8",
);
const [headerLine = "", firstLine = ""] = fixture.split("\n");

test("AC-002-14 the field list is the row contract's header and values are read by name", () => {
  assert.deepEqual([...ROW_FIELDS], headerLine.split("\t"));
  assert.equal(ROW_FIELDS.length, 20);
  assert.equal(isHeader(headerLine.split("\t")), true);
  assert.equal(isHeader(firstLine.split("\t")), false);

  const header = readHeader(headerLine.split("\t"));
  const row = toRecord(header, firstLine.split("\t"));
  assert.equal(row.orderName, "171-1000003-1000003");
  assert.equal(row["destination.countryCode"], "DE");
  assert.equal(row["weight.kg"], "0.012");
  assert.equal(row.taxReference, "");

  // A reordered header with an unknown name and a missing known name still reads by name.
  const reordered = readHeader(["weight.kg", "mystery", "orderName"]);
  assert.deepEqual(
    [...reordered.entries()],
    [
      ["weight.kg", 0],
      ["orderName", 2],
    ],
  );
  const record = toRecord(reordered, ["0.5", "x", "ORDER-1"]);
  assert.equal(record.orderName, "ORDER-1");
  assert.equal(record["weight.kg"], "0.5");
  assert.equal(record["destination.city"], "");
});
