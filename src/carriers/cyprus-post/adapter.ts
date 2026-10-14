// Cyprus Post (ePost) adapter. Scaffold only: the dom strategy is specified in
// spec 003, which is blocked on sanitized portal fixtures (see README.md).
import type { Shipment } from "../../core/shipment.ts";
import { type CarrierAdapter, CarrierError, type SupportVerdict } from "../_contract/adapter.ts";

export const cyprusPost: CarrierAdapter = {
  info: {
    id: "cyprus-post",
    name: "Cyprus Post (ePost)",
    strategy: "dom",
    // Portal match patterns are added by spec 003 together with the fixtures.
    portalMatches: [],
    senderCountryCodes: ["CY"],
  },

  supports(_shipment: Shipment): SupportVerdict {
    return { supported: true };
  },

  async createLabel(): Promise<never> {
    throw new CarrierError(
      "not_implemented",
      "The Cyprus Post adapter is scaffolded only. See docs/specs/README.md, spec 003.",
    );
  },
};
