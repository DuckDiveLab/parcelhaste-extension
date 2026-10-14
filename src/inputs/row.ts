// Turns pasted export rows into one Shipment plus a validation report (spec 002).
import {
  type Item,
  requiresCustomsDeclaration,
  type Shipment,
  ShipmentSchema,
} from "../core/shipment.ts";
import {
  EXPORT_COLUMNS,
  type ExportColumn,
  type ExportRow,
  isHeaderRow,
  OPTIONAL_CONTACT_COLUMNS,
  RECIPIENT_IDENTITY_COLUMNS,
  REQUIRED_COLUMNS,
  toExportRow,
} from "./column-map.ts";

export type IssueCode =
  | "empty-paste"
  | "cell-count"
  | "already-shipped"
  | "required-cell-empty"
  | "optional-cell-empty"
  | "one-order-per-paste"
  | "country-code"
  | "recipient-mismatch"
  | "number-invalid"
  | "currency-defaulted"
  | "weight-required"
  | "weight-invalid"
  | "schema";

export interface RowIssue {
  level: "error" | "warning";
  code: IssueCode;
  message: string;
  /** 1-based line in the pasted text, header included. */
  line?: number;
  column?: ExportColumn;
}

export interface RowParseOptions {
  /** Weight typed in the panel; takes precedence over the Package weight cell (AC-002-10). */
  weight?: string;
}

export interface RowParseResult {
  /** Present only when the report has no errors. */
  shipment?: Shipment;
  issues: RowIssue[];
}

/** Below this a weight is kilograms, from it on grams (AC-002-11). */
export const KILOGRAM_THRESHOLD = 50;

/** AC-002-1: rows on CR, LF or CRLF, cells on tabs, empty trailing lines dropped. */
export function splitClipboard(text: string): string[][] {
  const lines = text.split(/\r\n|\r|\n/);
  while (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() === "") {
    lines.pop();
  }
  return lines.map((line) => line.split("\t"));
}

/** Accepts "12.5", "12.50" and the comma decimal Excel writes in some locales ("12,50"). */
export function parseNumber(value: string): number | undefined {
  const normalized = value.trim().replace(/^(-?\d+),(\d+)$/, "$1.$2");
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : undefined;
}

/** AC-002-11: integer grams, or undefined when the value is not a positive number. */
export function parseWeightGrams(value: string): number | undefined {
  const amount = parseNumber(value);
  if (amount === undefined || amount <= 0) {
    return undefined;
  }
  return Math.round(amount < KILOGRAM_THRESHOLD ? amount * 1000 : amount);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeCountryCode(value: string): string {
  const code = value.trim().toUpperCase();
  return code === "UK" ? "GB" : code;
}

function comparable(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

interface Line {
  line: number;
  row: ExportRow;
}

export function parseExportRows(text: string, options: RowParseOptions = {}): RowParseResult {
  const issues: RowIssue[] = [];
  const fail = (code: IssueCode, message: string, where: Partial<RowIssue> = {}): void => {
    issues.push({ level: "error", code, message, ...where });
  };
  const warn = (code: IssueCode, message: string, where: Partial<RowIssue> = {}): void => {
    issues.push({ level: "warning", code, message, ...where });
  };
  const hasErrors = (): boolean => issues.some((issue) => issue.level === "error");

  const cellLines = splitClipboard(text);
  let firstLine = 1;
  if (cellLines.length > 0 && isHeaderRow(cellLines[0] ?? [])) {
    cellLines.shift();
    firstLine = 2;
  }
  if (cellLines.length === 0) {
    fail("empty-paste", "Paste one order's row (or rows) from the shipping export.");
    return { issues };
  }

  const lines: Line[] = [];
  cellLines.forEach((cells, index) => {
    const line = firstLine + index;
    if (cells.length !== EXPORT_COLUMNS.length) {
      fail(
        "cell-count",
        `Line ${line} has ${cells.length} cells, expected ${EXPORT_COLUMNS.length}.`,
        { line },
      );
      return;
    }
    lines.push({ line, row: toExportRow(cells) });
  });
  if (hasErrors()) {
    return { issues };
  }
  const first = lines[0] as Line;

  for (const { line, row } of lines) {
    if (row["Tracking number"] !== "") {
      fail(
        "already-shipped",
        `Line ${line} already has tracking number ${row["Tracking number"]}.`,
        {
          line,
          column: "Tracking number",
        },
      );
    }
    for (const column of REQUIRED_COLUMNS) {
      if (row[column] === "") {
        fail("required-cell-empty", `Line ${line}: ${column} is empty.`, { line, column });
      }
    }
  }

  const orderIds = [...new Set(lines.map(({ row }) => row["order-id"]).filter((id) => id !== ""))];
  if (orderIds.length > 1) {
    fail("one-order-per-paste", `one order per paste: found ${orderIds.join(", ")}.`, {
      column: "order-id",
    });
  }

  const countryCode = normalizeCountryCode(first.row["ship-country-code"]);
  if (first.row["ship-country-code"] !== "" && !/^[A-Z]{2}$/.test(countryCode)) {
    fail(
      "country-code",
      `ship-country-code "${first.row["ship-country-code"]}" is not a two-letter code.`,
      {
        line: first.line,
        column: "ship-country-code",
      },
    );
  }

  for (const column of RECIPIENT_IDENTITY_COLUMNS) {
    const values = new Set(lines.map(({ row }) => comparable(row[column])));
    if (values.size > 1) {
      fail("recipient-mismatch", `Rows of order ${orderIds[0] ?? ""} disagree on ${column}.`, {
        column,
      });
    }
  }

  for (const column of OPTIONAL_CONTACT_COLUMNS) {
    if (first.row[column] === "") {
      warn("optional-cell-empty", `${column} is empty.`, { line: first.line, column });
    }
  }

  const items: Item[] = [];
  for (const { line, row } of lines) {
    const quantity = parseNumber(row["quantity-purchased"]);
    if (quantity === undefined || !Number.isInteger(quantity) || quantity <= 0) {
      fail(
        "number-invalid",
        `Line ${line}: quantity-purchased "${row["quantity-purchased"]}" is not a positive whole number.`,
        {
          line,
          column: "quantity-purchased",
        },
      );
    }
    const linePrice = parseNumber(row["item-price"]);
    if (linePrice === undefined || linePrice < 0) {
      fail("number-invalid", `Line ${line}: item-price "${row["item-price"]}" is not a price.`, {
        line,
        column: "item-price",
      });
    }
    let currency = row.currency.toUpperCase();
    if (currency === "") {
      currency = "EUR";
      warn("currency-defaulted", `Line ${line}: currency is empty, assuming EUR.`, {
        line,
        column: "currency",
      });
    }
    if (quantity !== undefined && quantity > 0 && linePrice !== undefined) {
      items.push({
        sku: row.SKU,
        description: row["product-name"],
        quantity,
        unitPrice: { amount: round2(linePrice / quantity), currency },
      });
    }
  }

  let shippingPrice: Shipment["shippingPrice"];
  if (first.row["shipping-price"] !== "") {
    const amount = parseNumber(first.row["shipping-price"]);
    if (amount === undefined || amount < 0) {
      fail("number-invalid", `shipping-price "${first.row["shipping-price"]}" is not a price.`, {
        line: first.line,
        column: "shipping-price",
      });
    } else {
      shippingPrice = { amount: round2(amount), currency: items[0]?.unitPrice.currency ?? "EUR" };
    }
  }

  const typedWeight = options.weight?.trim() ?? "";
  const weightSource = typedWeight !== "" ? typedWeight : first.row["Package weight"];
  let weightGrams: number | undefined;
  if (weightSource === "") {
    fail("weight-required", "Type the parcel weight: grams, or kilograms below 50.", {
      column: "Package weight",
    });
  } else {
    weightGrams = parseWeightGrams(weightSource);
    if (weightGrams === undefined) {
      fail("weight-invalid", `Weight "${weightSource}" is not a positive number.`, {
        column: "Package weight",
      });
    }
  }

  if (hasErrors() || weightGrams === undefined) {
    return { issues };
  }

  const recipient = {
    name: first.row["recipient-name"],
    line1: first.row["ship-address-1"],
    ...(first.row["ship-address-2"] !== "" && { line2: first.row["ship-address-2"] }),
    ...(first.row["ship-address-3"] !== "" && { line3: first.row["ship-address-3"] }),
    city: first.row["ship-city"],
    ...(first.row["ship-state"] !== "" && { state: first.row["ship-state"] }),
    ...(first.row["ship-postal-code"] !== "" && { postalCode: first.row["ship-postal-code"] }),
    countryCode,
    ...(first.row["buyer-phone-number"] !== "" && { phone: first.row["buyer-phone-number"] }),
    ...(first.row["buyer-email"] !== "" && { email: first.row["buyer-email"] }),
  };
  const currency = items[0]?.unitPrice.currency ?? "EUR";
  const candidate = {
    orderId: first.row["order-id"],
    recipient,
    parcel: { weightGrams },
    items,
    ...(shippingPrice !== undefined && { shippingPrice }),
    ...(requiresCustomsDeclaration({ recipient }) && {
      customs: { category: "sale_of_goods" as const, currency },
    }),
    sourceRows: lines.map(({ line }) => line),
  };

  const parsed = ShipmentSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      fail("schema", `${issue.path.join(".")}: ${issue.message}`);
    }
    return { issues };
  }
  return { shipment: parsed.data, issues };
}
