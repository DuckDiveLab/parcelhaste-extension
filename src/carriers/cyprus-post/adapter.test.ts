import { readFileSync } from "node:fs";
import path from "node:path";
import { ShipmentSchema } from "../../core/shipment.ts";
import { runCarrierContract } from "../_contract/testing.ts";
import { cyprusPost } from "./adapter.ts";

const fixturesDir = path.resolve(import.meta.dirname, "../../../fixtures/shipments");
const shipments = ["eu-single-item.json", "non-eu-multi-item.json"].map((name) =>
  ShipmentSchema.parse(JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8"))),
);

runCarrierContract(cyprusPost, { shipments });
