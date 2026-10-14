import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { EXPORT_COLUMNS, type ExportColumn, toExportRow } from "./column-map.ts";
import { parseExportRows, parseWeightGrams, type RowIssue, splitClipboard } from "./row.ts";

const fixture = readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/rows/cyprus-post-export.tsv"),
  "utf8",
);
const lines = fixture.split("\n").filter((line) => line !== "");
const HEADER = lines[0] ?? "";
const DE_ROW = lines[1] ?? "";
const GB_ROWS = [lines[2] ?? "", lines[3] ?? ""];
const US_ROW = lines[4] ?? "";

/** A row based on the German fixture row with some cells replaced. */
function row(overrides: Partial<Record<ExportColumn, string>>, base = DE_ROW): string {
  const cells = toExportRow(base.split("\t"));
  return EXPORT_COLUMNS.map((column) => overrides[column] ?? cells[column]).join("\t");
}

function codes(issues: RowIssue[], level?: RowIssue["level"]): string[] {
  return issues.filter((issue) => level === undefined || issue.level === level).map((i) => i.code);
}

test("AC-002-1 splits rows on CR, LF or CRLF and cells on tabs, dropping empty trailing lines", () => {
  assert.deepEqual(splitClipboard("a\tb\r\nc\td\rE\tf\n\n \n"), [
    ["a", "b"],
    ["c", "d"],
    ["E", "f"],
  ]);
  assert.deepEqual(splitClipboard(""), []);
  assert.ok(parseExportRows(`${DE_ROW}\r\n`).shipment);
});

test("AC-002-2 skips a leading header row", () => {
  assert.ok(parseExportRows(`${HEADER}\n${DE_ROW}\n`).shipment);
  const headerOnly = parseExportRows(`${HEADER}\n`);
  assert.equal(headerOnly.shipment, undefined);
  assert.deepEqual(codes(headerOnly.issues), ["empty-paste"]);
});

test("AC-002-3 reports a wrong cell count with the line number and both counts, no shipment", () => {
  const short = DE_ROW.split("\t").slice(0, 21).join("\t");
  const result = parseExportRows(`${HEADER}\n${DE_ROW}\n${short}`);
  assert.equal(result.shipment, undefined);
  assert.deepEqual(codes(result.issues), ["cell-count"]);
  assert.equal(result.issues[0]?.line, 3);
  assert.match(result.issues[0]?.message ?? "", /21 cells, expected 22/);
});

test("AC-002-4 one order id gives one shipment with one item per row", () => {
  const result = parseExportRows(GB_ROWS.join("\n"));
  const shipment = result.shipment;
  assert.ok(shipment, JSON.stringify(result.issues));
  assert.equal(shipment.orderId, "TEST-ORDER-0002");
  assert.equal(shipment.recipient.name, "Second Tester");
  assert.equal(shipment.recipient.line2, "Flat 3");
  assert.deepEqual(shipment.shippingPrice, { amount: 6.9, currency: "EUR" });
  assert.deepEqual(
    shipment.items.map((item) => [
      item.sku,
      item.description,
      item.quantity,
      item.unitPrice.amount,
    ]),
    [
      ["WIDGET-001", "Example Widget", 2, 12.5],
      ["GADGET-002", "Example Gadget", 1, 20],
    ],
  );
  assert.deepEqual(shipment.sourceRows, [1, 2]);
  assert.equal(shipment.parcel.weightGrams, 600);

  const lineTotal = parseExportRows(row({ "item-price": "25.00", "quantity-purchased": "2" }));
  assert.equal(lineTotal.shipment?.items[0]?.unitPrice.amount, 12.5);
  const commaDecimal = parseExportRows(row({ "item-price": "12,50", "shipping-price": "4,90" }));
  assert.equal(commaDecimal.shipment?.items[0]?.unitPrice.amount, 12.5);
  assert.equal(commaDecimal.shipment?.shippingPrice?.amount, 4.9);
});

test("AC-002-5 rows with more than one order id are refused", () => {
  const result = parseExportRows(`${DE_ROW}\n${row({ "Package weight": "300" }, US_ROW)}`);
  assert.equal(result.shipment, undefined);
  assert.ok(codes(result.issues).includes("one-order-per-paste"));
  assert.match(
    result.issues.find((i) => i.code === "one-order-per-paste")?.message ?? "",
    /one order per paste/,
  );
});

test("AC-002-6 an empty required cell names the row and the column, no shipment", () => {
  const required: ExportColumn[] = [
    "order-id",
    "SKU",
    "quantity-purchased",
    "product-name",
    "recipient-name",
    "ship-address-1",
    "ship-city",
    "ship-country-code",
  ];
  for (const column of required) {
    const result = parseExportRows(`${HEADER}\n${row({ [column]: "" })}`);
    assert.equal(result.shipment, undefined, column);
    const issue = result.issues.find((i) => i.code === "required-cell-empty");
    assert.equal(issue?.column, column);
    assert.equal(issue?.line, 2);
  }
});

test("AC-002-7 empty phone, email or postcode only warns", () => {
  const result = parseExportRows(
    row({ "buyer-phone-number": "", "buyer-email": "", "ship-postal-code": "" }),
  );
  assert.ok(result.shipment);
  assert.equal(result.shipment.recipient.phone, undefined);
  assert.deepEqual(codes(result.issues, "error"), []);
  assert.deepEqual(
    result.issues.filter((i) => i.code === "optional-cell-empty").map((i) => i.column),
    ["buyer-phone-number", "buyer-email", "ship-postal-code"],
  );
});

test("AC-002-8 country codes are uppercased, UK becomes GB, anything else than two letters fails", () => {
  assert.equal(
    parseExportRows(row({ "ship-country-code": "gb" })).shipment?.recipient.countryCode,
    "GB",
  );
  assert.equal(
    parseExportRows(row({ "ship-country-code": "UK" })).shipment?.recipient.countryCode,
    "GB",
  );
  const bad = parseExportRows(row({ "ship-country-code": "GBR" }));
  assert.equal(bad.shipment, undefined);
  assert.deepEqual(codes(bad.issues, "error"), ["country-code"]);
});

test("AC-002-9 destinations outside the EU get customs as sale of goods, inside the EU none", () => {
  const us = parseExportRows(row({ "Package weight": "300" }, US_ROW));
  assert.deepEqual(us.shipment?.customs, { category: "sale_of_goods", currency: "EUR" });
  assert.equal(parseExportRows(DE_ROW).shipment?.customs, undefined);
});

test("AC-002-10 an empty weight is an error unless a weight was typed, which always wins", () => {
  const missing = parseExportRows(US_ROW);
  assert.equal(missing.shipment, undefined);
  assert.deepEqual(codes(missing.issues, "error"), ["weight-required"]);
  assert.equal(parseExportRows(US_ROW, { weight: "300" }).shipment?.parcel.weightGrams, 300);
  assert.equal(parseExportRows(DE_ROW, { weight: "0.5" }).shipment?.parcel.weightGrams, 500);
  assert.equal(parseExportRows(DE_ROW, { weight: "  " }).shipment?.parcel.weightGrams, 250);
});

test("AC-002-11 weights below 50 are kilograms, 50 and above grams, anything else an error", () => {
  assert.equal(parseWeightGrams("0.25"), 250);
  assert.equal(parseWeightGrams("1,2"), 1200);
  assert.equal(parseWeightGrams("49.9"), 49900);
  assert.equal(parseWeightGrams("50"), 50);
  assert.equal(parseWeightGrams("250"), 250);
  for (const bad of ["abc", "0", "-5", ""]) {
    assert.equal(parseWeightGrams(bad), undefined, bad);
  }
  const result = parseExportRows(DE_ROW, { weight: "heavy" });
  assert.equal(result.shipment, undefined);
  assert.deepEqual(codes(result.issues, "error"), ["weight-invalid"]);
});

test("AC-002-12 a row that already has a tracking number is refused as already shipped", () => {
  const result = parseExportRows(row({ "Tracking number": "RR123456789CY" }));
  assert.equal(result.shipment, undefined);
  assert.deepEqual(codes(result.issues, "error"), ["already-shipped"]);
});

test("AC-002-13 rows of one order must agree on the recipient", () => {
  const [first = "", second = ""] = GB_ROWS;
  const result = parseExportRows(`${first}\n${row({ "ship-postal-code": "SW1A 2AA" }, second)}`);
  assert.equal(result.shipment, undefined);
  const issue = result.issues.find((i) => i.code === "recipient-mismatch");
  assert.equal(issue?.column, "ship-postal-code");
});

test("values the schema rejects surface as schema errors, not crashes", () => {
  const result = parseExportRows(row({ "buyer-email": "not-an-email" }));
  assert.equal(result.shipment, undefined);
  assert.deepEqual(codes(result.issues, "error"), ["schema"]);
  assert.match(result.issues[0]?.message ?? "", /email/);
});
