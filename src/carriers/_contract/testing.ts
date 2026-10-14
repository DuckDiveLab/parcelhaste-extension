// Shared contract test suite. Test-only code: files named testing.ts or *.test.ts
// may import node:test; nothing else under src/ may.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { type Shipment, ShipmentSchema } from "../../core/shipment.ts";
import { type CarrierAdapter, CarrierError } from "./adapter.ts";

export interface ContractFixtures {
  /** Synthetic shipments only. At least one. */
  shipments: readonly Shipment[];
}

const STRATEGIES = new Set(["dom", "http", "api"]);

/** Registers the contract tests for one adapter. Call it from the carrier's adapter.test.ts. */
export function runCarrierContract(adapter: CarrierAdapter, fixtures: ContractFixtures): void {
  describe(`carrier contract: ${adapter.info.id}`, () => {
    test("AC-001-5 info has a slug id, a known strategy and non-empty names", () => {
      assert.match(adapter.info.id, /^[a-z0-9-]+$/);
      assert.ok(STRATEGIES.has(adapter.info.strategy), `strategy ${adapter.info.strategy}`);
      assert.ok(adapter.info.name.length > 0);
      assert.ok(adapter.info.senderCountryCodes.length > 0);
    });

    test("AC-001-6 supports() returns a verdict for every fixture without throwing", () => {
      assert.ok(fixtures.shipments.length > 0, "at least one fixture shipment");
      for (const shipment of fixtures.shipments) {
        ShipmentSchema.parse(shipment);
        const verdict = adapter.supports(shipment);
        assert.equal(typeof verdict.supported, "boolean");
        if (!verdict.supported) {
          assert.ok(verdict.reason.length > 0, "a refusal carries a reason");
        }
      }
    });

    test("AC-001-7 createLabel() resolves to a LabelResult or rejects with a CarrierError", async () => {
      for (const shipment of fixtures.shipments) {
        if (!adapter.supports(shipment).supported) {
          continue;
        }
        try {
          const result = await adapter.createLabel(shipment, {
            signal: new AbortController().signal,
          });
          assert.ok(result.shipmentNumber.length > 0);
          assert.equal(result.label.mimeType, "application/pdf");
          assert.ok(result.label.bytes.length > 0);
        } catch (error) {
          assert.ok(error instanceof CarrierError, `rejected with ${String(error)}`);
          assert.ok(error.code.length > 0);
        }
      }
    });
  });
}
