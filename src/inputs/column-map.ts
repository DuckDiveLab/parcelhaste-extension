// The Cyprus Post shipping export, column by column (spec 002). The only place that knows cell
// positions: every reader goes through toExportRow() (AC-002-14).

export const EXPORT_COLUMNS = [
  "Tracking number",
  "Multiple",
  "order-id",
  "ship-country",
  "Package weight",
  "product-name",
  "SKU",
  "quantity-purchased",
  "currency",
  "item-price",
  "shipping-price",
  "postage-item-price",
  "buyer-phone-number",
  "buyer-email",
  "recipient-name",
  "ship-postal-code",
  "ship-city",
  "ship-state",
  "ship-address-1",
  "ship-address-2",
  "ship-address-3",
  "ship-country-code",
] as const;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];
export type ExportRow = Readonly<Record<ExportColumn, string>>;

/** Cells that must be filled for a shipment to exist (AC-002-6). */
export const REQUIRED_COLUMNS: readonly ExportColumn[] = [
  "order-id",
  "SKU",
  "quantity-purchased",
  "product-name",
  "recipient-name",
  "ship-address-1",
  "ship-city",
  "ship-country-code",
];

/** Cells whose absence is only a warning (AC-002-7). */
export const OPTIONAL_CONTACT_COLUMNS: readonly ExportColumn[] = [
  "buyer-phone-number",
  "buyer-email",
  "ship-postal-code",
];

/** Cells every row of one order must agree on (AC-002-13). */
export const RECIPIENT_IDENTITY_COLUMNS: readonly ExportColumn[] = [
  "recipient-name",
  "ship-address-1",
  "ship-postal-code",
  "ship-country-code",
];

/** True when the cells are the export's header line (AC-002-2). */
export function isHeaderRow(cells: readonly string[]): boolean {
  return (
    cells.length === EXPORT_COLUMNS.length &&
    cells.every((cell, index) => cell.trim() === EXPORT_COLUMNS[index])
  );
}

/** Names the cells of one line. Cells are trimmed. */
export function toExportRow(cells: readonly string[]): ExportRow {
  if (cells.length !== EXPORT_COLUMNS.length) {
    throw new Error(`expected ${EXPORT_COLUMNS.length} cells, got ${cells.length}`);
  }
  return Object.fromEntries(
    EXPORT_COLUMNS.map((column, index) => [column, (cells[index] ?? "").trim()]),
  ) as Record<ExportColumn, string>;
}
