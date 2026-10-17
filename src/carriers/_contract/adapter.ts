// The carrier adapter contract (ADR-0004). Every carrier under src/carriers/<id>/
// implements CarrierAdapter and passes runCarrierContract() from ./testing.ts.
import type { AdapterStage } from "../../core/queue.ts";
import type { Shipment } from "../../core/shipment.ts";

/** How the adapter talks to the carrier: fill the page, replay its requests, or call an API. */
export type Strategy = "dom" | "http" | "api";

export interface CarrierInfo {
  /** Lowercase slug, also the directory name and the Downloads subfolder. */
  readonly id: string;
  readonly name: string;
  readonly strategy: Strategy;
  /** Match patterns of the portal pages the adapter works on, e.g. "https://*.example.com/*". */
  readonly portalMatches: readonly string[];
  /** Countries the carrier ships from. */
  readonly senderCountryCodes: readonly string[];
}

export type CarrierErrorCode =
  | "not_implemented"
  | "not_logged_in"
  | "unsupported_shipment"
  | "invalid_shipment"
  | "portal_changed"
  | "portal_rejected"
  | "network"
  | "cancelled";

export class CarrierError extends Error {
  readonly code: CarrierErrorCode;
  readonly retryable: boolean;

  constructor(
    code: CarrierErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "CarrierError";
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}

export interface LabelResult {
  /** The carrier's identifier for the shipment; present even for untracked services. */
  shipmentNumber: string;
  /** Present only when the service is tracked. */
  trackingNumber?: string;
  label: {
    bytes: Uint8Array;
    mimeType: "application/pdf";
  };
}

export interface CarrierContext {
  /** Aborted when the user stops the run. Adapters must stop at the next safe point. */
  signal: AbortSignal;
  /** Reports `submitting` when the form goes off and `capturing` while the numbers are read. */
  onStage?: (stage: AdapterStage) => void;
}

export type SupportVerdict = { supported: true } | { supported: false; reason: string };

export interface CarrierAdapter {
  readonly info: CarrierInfo;
  /** Cheap, synchronous check that this carrier can take the shipment at all. */
  supports(shipment: Shipment): SupportVerdict;
  /** Creates the label and customs declaration. Rejects only with CarrierError. */
  createLabel(shipment: Shipment, context: CarrierContext): Promise<LabelResult>;
}
