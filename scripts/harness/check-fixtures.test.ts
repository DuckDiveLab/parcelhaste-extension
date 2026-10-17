import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFixtures } from "./check-fixtures.ts";
import { makeRepo, rules } from "./testing.ts";

test("accepts example.com emails, drama-range phones and short digit runs", () => {
  const root = makeRepo({
    "fixtures/rows/a.tsv":
      "buyer@example.com\t+44 7700 900123\t+1 212 555 0142\t10115\t392690\tSW1A 1AA\n",
    "fixtures/shipments/a.json": '{"email":"x@sub.example.org","phone":"(555) 0101"}',
  });
  assert.deepEqual(checkFixtures(root), []);
});

test("fails on an email outside the reserved domains", () => {
  const root = makeRepo({ "fixtures/rows/a.tsv": "jane.doe@gmail.com\n" });
  assert.deepEqual(rules(checkFixtures(root)), ["fixture-email"]);
});

test("fails on a phone number outside the reserved ranges", () => {
  for (const phone of ["+357 99 123456", "0030 210 1234567", "+1 (212) 867-5309"]) {
    const root = makeRepo({ "fixtures/rows/a.tsv": `name\t${phone}\n` });
    assert.deepEqual(rules(checkFixtures(root)), ["fixture-phone"], phone);
  }
});

test("ignores binary fixtures and files outside fixtures/", () => {
  const root = makeRepo({
    "fixtures/carriers/x/label.pdf": "jane.doe@gmail.com +357 99 123456",
    "docs/notes.md": "jane.doe@gmail.com",
  });
  assert.deepEqual(checkFixtures(root), []);
});

test("does not mistake price columns in a TSV row for phone numbers", () => {
  const root = makeRepo({ "fixtures/rows/a.tsv": "1\tEUR\t12.50\t4.90\t0.00\t+44 7700 900123\n" });
  assert.deepEqual(checkFixtures(root), []);
});

test("does not mistake an IOSS number or a tracking number for a phone", () => {
  const root = makeRepo({
    "fixtures/rows/a.tsv": "IM1234567890\tRR123456789CY\t+44 7700 900123\n",
  });
  assert.deepEqual(checkFixtures(root), []);
});
