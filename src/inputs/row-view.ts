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
  const { shipments, rows, issues } = result;
  if (rows > 1) {
    return {
      canCreate: false,
      issues: [
        {
          level: "error",
          code: "one-row-per-paste",
          message: `one row per paste: ${rows} rows were pasted.`,
        },
        ...issues,
      ],
    };
  }
  const shipment = shipments[0];
  if (rows !== 1 || shipment === undefined) {
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
