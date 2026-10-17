import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ROW_FIELDS, type RowField, readHeader, toRecord } from "./column-map.ts";
import { parseContents, parseRows, type RowIssue, splitClipboard } from "./row.ts";

const fixture = readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/rows/make-label.tsv"),
  "utf8",
);
const lines = fixture.split("\n").filter((line) => line !== "");
const HEADER = lines[0] ?? "";
const DE_ROW = lines[1] ?? "";
const GB_ROW = lines[2] ?? "";
const US_ROW = lines[3] ?? "";

/** The German fixture row with some values replaced, header included. */
function paste(overrides: Partial<Record<RowField, string>> = {}, base = DE_ROW): string {
  const record = toRecord(readHeader(HEADER.split("\t")), base.split("\t"));
  const row = ROW_FIELDS.map((field) => overrides[field] ?? record[field]).join("\t");
  return `${HEADER}\n${row}\n`;
}

function codes(issues: RowIssue[], level?: RowIssue["level"]): string[] {
  return issues.filter((i) => level === undefined || i.level === level).map((i) => i.code);
}

test("AC-002-1 splits lines on CR, LF or CRLF and cells on tabs; a trailing tab is an empty cell", () => {
  assert.deepEqual(splitClipboard("a\tb\t\r\nc\td\rE\tf\n\n \n"), [
    ["a", "b", ""],
    ["c", "d"],
    ["E", "f"],
  ]);
  assert.deepEqual(splitClipboard(""), []);
  const result = parseRows(`${HEADER}\r\n${DE_ROW}\r\n`);
  assert.equal(result.shipments.length, 1, JSON.stringify(result.issues));
});

test("AC-002-2 a paste without the header line is refused", () => {
  const result = parseRows(`${DE_ROW}\n`);
  assert.deepEqual(result.shipments, []);
  assert.deepEqual(codes(result.issues), ["header-required"]);
  assert.deepEqual(codes(parseRows("").issues), ["empty-paste"]);
  assert.deepEqual(codes(parseRows(`${HEADER}\n`).issues), ["empty-paste"]);
});

test("AC-002-3 values are read by name: reordered header, unknown names ignored, missing names empty", () => {
  const record = toRecord(readHeader(HEADER.split("\t")), DE_ROW.split("\t"));
  const names = [
    "destination.name",
    "mystery",
    "orderName",
    "weight.kg",
    "quantity",
    "contents",
    "destination.address1",
    "destination.city",
    "destination.countryCode",
  ];
  const values = [
    record["destination.name"],
    "ignored",
    record.orderName,
    record["weight.kg"],
    record.quantity,
    record.contents,
    record["destination.address1"],
    record["destination.city"],
    record["destination.countryCode"],
  ];
  const result = parseRows(`${names.join("\t")}\n${values.join("\t")}\n`);
  const shipment = result.shipments[0];
  assert.ok(shipment, JSON.stringify(result.issues));
  assert.equal(shipment.orderId, "171-1000003-1000003");
  assert.equal(shipment.recipient.email, undefined, "destination.email was not in the header");
  assert.ok(codes(result.issues, "warning").includes("optional-field-empty"));
});

test("AC-002-4 more cells than the header is an error for that line; fewer read as empty", () => {
  const extra = parseRows(`${HEADER}\n${DE_ROW}\textra\n`);
  assert.deepEqual(extra.shipments, []);
  assert.deepEqual(codes(extra.issues), ["cell-count"]);
  assert.equal(extra.issues[0]?.line, 2);
  assert.match(extra.issues[0]?.message ?? "", /21 cells, the header has 20/);

  const short = parseRows(`${HEADER}\n${DE_ROW.split("\t").slice(0, 15).join("\t")}\n`);
  assert.equal(short.shipments.length, 1, JSON.stringify(short.issues));
  assert.equal(short.shipments[0]?.customs, undefined);
});

test("AC-002-5 one shipment per data line, issues carry line numbers", () => {
  const result = parseRows(`${HEADER}\n${DE_ROW}\n${GB_ROW}\n${US_ROW}\n`);
  assert.equal(result.rows, 3);
  assert.deepEqual(
    result.shipments.map((s) => s.orderId),
    ["171-1000003-1000003", "171-1000004-1000004", "171-1000005-1000005"],
  );
  assert.deepEqual(
    result.shipments.map((s) => s.sourceRows),
    [[2], [3], [4]],
  );
  const broken = parseRows(`${HEADER}\n${DE_ROW}\n${GB_ROW.replace("0.214", "zero")}\n`);
  assert.equal(broken.shipments.length, 1);
  assert.equal(broken.issues.find((i) => i.code === "weight-invalid")?.line, 3);
});

test("AC-002-6 an empty required value names the line and the field, no shipment for that line", () => {
  const required: RowField[] = [
    "orderName",
    "destination.name",
    "destination.address1",
    "destination.city",
    "destination.countryCode",
    "weight.kg",
    "quantity",
    "contents",
  ];
  for (const field of required) {
    const result = parseRows(paste({ [field]: "" }));
    assert.deepEqual(result.shipments, [], field);
    const issue = result.issues.find((i) => i.code === "required-field-empty");
    assert.equal(issue?.field, field);
    assert.equal(issue?.line, 2);
  }
});

test("AC-002-7 empty phone, email or zip only warns", () => {
  const result = parseRows(
    paste({ "destination.phone": "", "destination.email": "", "destination.zip": "" }),
  );
  assert.equal(result.shipments.length, 1);
  assert.equal(result.shipments[0]?.recipient.phone, undefined);
  assert.deepEqual(codes(result.issues, "error"), []);
  assert.deepEqual(
    result.issues.filter((i) => i.code === "optional-field-empty").map((i) => i.field),
    ["destination.phone", "destination.email", "destination.zip"],
  );
});

test("AC-002-8 country codes are uppercased, UK becomes GB, anything else than two letters fails", () => {
  assert.equal(
    parseRows(paste({ "destination.countryCode": "gb", declaredValue: "1", currencyCode: "EUR" }))
      .shipments[0]?.recipient.countryCode,
    "GB",
  );
  assert.equal(
    parseRows(paste({ "destination.countryCode": "UK", declaredValue: "1", currencyCode: "EUR" }))
      .shipments[0]?.recipient.countryCode,
    "GB",
  );
  const bad = parseRows(paste({ "destination.countryCode": "DEU" }));
  assert.deepEqual(bad.shipments, []);
  assert.deepEqual(codes(bad.issues, "error"), ["country-code"]);
});

test("AC-002-9 weight.kg is kilograms stored as whole grams; non-positive or sub-gram is an error", () => {
  assert.equal(parseRows(paste({ "weight.kg": "0.012" })).shipments[0]?.parcel.weightGrams, 12);
  assert.equal(parseRows(paste({ "weight.kg": "1.250" })).shipments[0]?.parcel.weightGrams, 1250);
  assert.equal(parseRows(paste({ "weight.kg": "0,214" })).shipments[0]?.parcel.weightGrams, 214);
  for (const bad of ["heavy", "0", "-1", "0.0004"]) {
    const result = parseRows(paste({ "weight.kg": bad }));
    assert.deepEqual(result.shipments, [], bad);
    assert.deepEqual(codes(result.issues, "error"), ["weight-invalid"], bad);
  }
});

test("AC-002-10 quantity must be a positive whole number", () => {
  for (const bad of ["0", "1.5", "two", "-2"]) {
    const result = parseRows(paste({ quantity: bad }));
    assert.deepEqual(result.shipments, [], bad);
    assert.equal(result.issues.find((i) => i.code === "number-invalid")?.field, "quantity");
  }
});

test("AC-002-11 contents become items; HS code and origin go to the first item; totals are checked", () => {
  assert.deepEqual(parseContents("Washer nozzle x2, Fuel cap x1"), [
    { description: "Washer nozzle", quantity: 2 },
    { description: "Fuel cap", quantity: 1 },
  ]);
  assert.deepEqual(parseContents("Mystery part"), [{ description: "Mystery part", quantity: 1 }]);
  assert.deepEqual(parseContents("Cap x0"), [{ description: "Cap x0", quantity: 1 }]);

  const result = parseRows(`${HEADER}\n${GB_ROW}\n`);
  const shipment = result.shipments[0];
  assert.ok(shipment, JSON.stringify(result.issues));
  assert.deepEqual(shipment.items, [
    { description: "Washer nozzle", quantity: 2, hsCode: "870899", originCountryCode: "CN" },
    { description: "Fuel cap", quantity: 1 },
  ]);
  assert.deepEqual(codes(result.issues, "warning"), []);

  const mismatch = parseRows(paste({ quantity: "5" }));
  assert.equal(mismatch.shipments.length, 1);
  assert.equal(mismatch.issues.find((i) => i.code === "quantity-mismatch")?.field, "contents");
});

test("AC-002-12 outside the EU customs carries the declared value, currency and tax reference", () => {
  const gb = parseRows(`${HEADER}\n${GB_ROW}\n`).shipments[0];
  assert.deepEqual(gb?.customs, {
    category: "sale_of_goods",
    currency: "EUR",
    declaredValue: { amount: 27.3, currency: "EUR" },
    taxReference: "IM1234567890",
  });
  const us = parseRows(`${HEADER}\n${US_ROW}\n`).shipments[0];
  assert.deepEqual(us?.customs?.declaredValue, { amount: 19.9, currency: "USD" });
  assert.equal(us?.customs?.taxReference, undefined);
  assert.equal(parseRows(`${HEADER}\n${DE_ROW}\n`).shipments[0]?.customs, undefined);

  const missing = parseRows(paste({ declaredValue: "" }, GB_ROW));
  assert.deepEqual(missing.shipments, []);
  assert.equal(
    missing.issues.find((i) => i.code === "declared-value-required")?.field,
    "declaredValue",
  );
  const noCurrency = parseRows(paste({ currencyCode: "" }, GB_ROW));
  assert.equal(
    noCurrency.issues.find((i) => i.code === "declared-value-required")?.field,
    "currencyCode",
  );
  const jpy = parseRows(paste({ declaredValue: "1200", currencyCode: "JPY" }, GB_ROW));
  assert.deepEqual(jpy.shipments[0]?.customs?.declaredValue, { amount: 1200, currency: "JPY" });
});

test("AC-002-13 company, province, address 2 and instructions are copied verbatim", () => {
  const gb = parseRows(`${HEADER}\n${GB_ROW}\n`).shipments[0];
  assert.equal(gb?.recipient.company, "Example Ltd");
  assert.equal(gb?.recipient.line2, "Flat 3");
  assert.equal(gb?.recipient.state, undefined);
  const us = parseRows(`${HEADER}\n${US_ROW}\n`).shipments[0];
  assert.equal(us?.recipient.state, "DC");
  const de = parseRows(
    paste({
      "deliveryMethod.additionalInformation.instructions": "  Ring twice, leave at the door  ",
    }),
  ).shipments[0];
  assert.equal(de?.deliveryInstructions, "Ring twice, leave at the door");
  assert.equal(de?.recipient.line1, "Teststraße 1");
});

test("AC-002-16 values the schema rejects surface as schema errors for that line", () => {
  const result = parseRows(paste({ "destination.email": "not-an-email" }));
  assert.deepEqual(result.shipments, []);
  assert.deepEqual(codes(result.issues, "error"), ["schema"]);
  assert.match(result.issues.find((i) => i.code === "schema")?.message ?? "", /email/);
  assert.equal(result.issues.find((i) => i.code === "schema")?.line, 2);
});
