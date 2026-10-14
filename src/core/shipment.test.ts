import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { requiresCustomsDeclaration, ShipmentSchema } from "./shipment.ts";

const fixturesDir = path.resolve(import.meta.dirname, "../../fixtures/shipments");

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8"));
}

test("AC-001-1 accepts an EU shipment with one item and no customs info", () => {
  const result = ShipmentSchema.safeParse(fixture("eu-single-item.json"));
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
});

test("AC-001-2 rejects item quantities that are not positive integers", () => {
  const shipment = ShipmentSchema.parse(fixture("eu-single-item.json"));
  for (const quantity of [0, -1, 1.5]) {
    const broken = { ...shipment, items: [{ ...shipment.items[0], quantity }] };
    assert.equal(ShipmentSchema.safeParse(broken).success, false, `quantity ${quantity}`);
  }
});

test("AC-001-3 accepts a non-EU shipment with customs info and several items", () => {
  const result = ShipmentSchema.safeParse(fixture("non-eu-multi-item.json"));
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  assert.equal(result.data?.items.length, 2);
  assert.equal(result.data?.customs?.category, "sale_of_goods");
});

test("AC-001-4 requiresCustomsDeclaration is false inside the EU and true outside", () => {
  assert.equal(requiresCustomsDeclaration({ recipient: { countryCode: "DE" } as never }), false);
  assert.equal(requiresCustomsDeclaration({ recipient: { countryCode: "CY" } as never }), false);
  assert.equal(requiresCustomsDeclaration({ recipient: { countryCode: "GB" } as never }), true);
  assert.equal(requiresCustomsDeclaration({ recipient: { countryCode: "US" } as never }), true);
});

test("AC-001-8 rejects money amounts with more than two decimals", () => {
  const shipment = ShipmentSchema.parse(fixture("eu-single-item.json"));
  const broken = { ...shipment, shippingPrice: { amount: 4.905, currency: "EUR" } };
  assert.equal(ShipmentSchema.safeParse(broken).success, false);
  const fine = { ...shipment, shippingPrice: { amount: 4.9, currency: "EUR" } };
  assert.equal(ShipmentSchema.safeParse(fine).success, true);
});
