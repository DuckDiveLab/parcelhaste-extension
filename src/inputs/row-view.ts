// What the side panel shows after a paste (spec 002, AC-002-15). Pure: no DOM here.
import type { RowIssue, RowParseResult } from "./row.ts";

export interface RowSummary {
  recipientName: string;
  countryCode: string;
  weightGrams: number;
  /** Units across all item lines. */
  itemCount: number;
}

export interface RowViewModel {
  canCreate: boolean;
  summary?: RowSummary;
  issues: RowIssue[];
}

export function rowViewModel(result: RowParseResult): RowViewModel {
  const { shipment, issues } = result;
  if (shipment === undefined) {
    return { canCreate: false, issues };
  }
  return {
    canCreate: true,
    summary: {
      recipientName: shipment.recipient.name,
      countryCode: shipment.recipient.countryCode,
      weightGrams: shipment.parcel.weightGrams,
      itemCount: shipment.items.reduce((total, item) => total + item.quantity, 0),
    },
    issues,
  };
}
