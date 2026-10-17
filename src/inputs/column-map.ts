// The row contract of the order tool's "Make label" step (spec 002). Values are found by header
// name, never by position; this list is the only place that names the fields (AC-002-14).

export const ROW_FIELDS = [
  "orderName",
  "destination.name",
  "destination.company",
  "destination.address1",
  "destination.address2",
  "destination.zip",
  "destination.city",
  "destination.province",
  "destination.countryCode",
  "destination.phone",
  "destination.email",
  "deliveryMethod.additionalInformation.instructions",
  "weight.kg",
  "quantity",
  "contents",
  "harmonizedSystemCode",
  "countryCodeOfOrigin",
  "declaredValue",
  "currencyCode",
  "taxReference",
] as const;

export type RowField = (typeof ROW_FIELDS)[number];
export type RowRecord = Readonly<Record<RowField, string>>;

/** The name every header must carry; its presence tells a header line from a data line. */
export const HEADER_MARKER: RowField = "orderName";

/** Values that must be filled for a shipment to exist (AC-002-6). */
export const REQUIRED_FIELDS: readonly RowField[] = [
  "orderName",
  "destination.name",
  "destination.address1",
  "destination.city",
  "destination.countryCode",
  "weight.kg",
  "quantity",
  "contents",
];

/** Values whose absence is only a warning (AC-002-7). */
export const OPTIONAL_CONTACT_FIELDS: readonly RowField[] = [
  "destination.phone",
  "destination.email",
  "destination.zip",
];

export type RowHeader = ReadonlyMap<RowField, number>;

export function isHeader(cells: readonly string[]): boolean {
  return cells.some((cell) => cell.trim() === HEADER_MARKER);
}

/** Header name → cell index. Unknown names are ignored; a repeated name keeps its first cell. */
export function readHeader(cells: readonly string[]): RowHeader {
  const known = new Set<string>(ROW_FIELDS);
  const header = new Map<RowField, number>();
  cells.forEach((cell, index) => {
    const name = cell.trim();
    if (known.has(name) && !header.has(name as RowField)) {
      header.set(name as RowField, index);
    }
  });
  return header;
}

/** Names the cells of one data line. A name missing from the header or beyond the line reads "". */
export function toRecord(header: RowHeader, cells: readonly string[]): RowRecord {
  return Object.fromEntries(
    ROW_FIELDS.map((field) => {
      const index = header.get(field);
      return [field, index === undefined ? "" : (cells[index] ?? "").trim()];
    }),
  ) as Record<RowField, string>;
}
