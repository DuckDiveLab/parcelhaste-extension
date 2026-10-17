// Turns the pasted "Make label" rows into shipments plus a validation report (spec 002).
import {
  type Item,
  requiresCustomsDeclaration,
  type Shipment,
  ShipmentSchema,
} from "../core/shipment.ts";
import {
  isHeader,
  OPTIONAL_CONTACT_FIELDS,
  REQUIRED_FIELDS,
  type RowField,
  type RowRecord,
  readHeader,
  toRecord,
} from "./column-map.ts";

export type IssueCode =
  | "empty-paste"
  | "header-required"
  | "cell-count"
  | "required-field-empty"
  | "optional-field-empty"
  | "country-code"
  | "weight-invalid"
  | "number-invalid"
  | "quantity-mismatch"
  | "declared-value-required"
  | "schema"
  | "one-row-per-paste";

export interface RowIssue {
  level: "error" | "warning";
  code: IssueCode;
  message: string;
  /** 1-based line in the pasted text; the header is line 1. */
  line?: number;
  field?: RowField;
}

export interface RowParseResult {
  /** One shipment per data line that passed every check, in line order. */
  shipments: Shipment[];
  /** Number of data lines seen, parsed or not. */
  rows: number;
  issues: RowIssue[];
}

export interface ContentLine {
  description: string;
  quantity: number;
}

/** AC-002-1: lines on CR, LF or CRLF, cells on tabs, empty trailing lines dropped. */
export function splitClipboard(text: string): string[][] {
  const lines = text.split(/\r\n|\r|\n/);
  while (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() === "") {
    lines.pop();
  }
  return lines.map((line) => line.split("\t"));
}

/** Accepts "12.5", "12.50" and a comma decimal ("12,50"). */
export function parseNumber(value: string): number | undefined {
  const normalized = value.trim().replace(/^(-?\d+),(\d+)$/, "$1.$2");
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : undefined;
}

/** AC-002-11: "Washer nozzle x2, Fuel cap x1" → two lines; a part without " xN" counts once. */
export function parseContents(contents: string): ContentLine[] {
  return contents
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => {
      const match = /^(.*\S)\s+x(\d+)$/.exec(part);
      const quantity = match?.[2] === undefined ? Number.NaN : Number(match[2]);
      return Number.isInteger(quantity) && quantity > 0
        ? { description: match?.[1] ?? part, quantity }
        : { description: part, quantity: 1 };
    });
}

function normalizeCountryCode(value: string): string {
  const code = value.trim().toUpperCase();
  return code === "UK" ? "GB" : code;
}

interface LineContext {
  line: number;
  row: RowRecord;
  missing: ReadonlySet<RowField>;
  issues: RowIssue[];
}

function parseLine(context: LineContext): Shipment | undefined {
  const { line, row, missing, issues } = context;
  const fail = (code: IssueCode, message: string, field?: RowField): void => {
    issues.push({ level: "error", code, message, line, ...(field !== undefined && { field }) });
  };
  const warn = (code: IssueCode, message: string, field?: RowField): void => {
    issues.push({ level: "warning", code, message, line, ...(field !== undefined && { field }) });
  };
  const before = issues.length;

  for (const field of REQUIRED_FIELDS) {
    if (row[field] === "") {
      const where = missing.has(field) ? " (not in the header)" : "";
      fail("required-field-empty", `Line ${line}: ${field} is empty${where}.`, field);
    }
  }
  for (const field of OPTIONAL_CONTACT_FIELDS) {
    if (row[field] === "") {
      warn("optional-field-empty", `Line ${line}: ${field} is empty.`, field);
    }
  }

  const countryCode = normalizeCountryCode(row["destination.countryCode"]);
  if (row["destination.countryCode"] !== "" && !/^[A-Z]{2}$/.test(countryCode)) {
    fail(
      "country-code",
      `Line ${line}: destination.countryCode "${row["destination.countryCode"]}" is not a two-letter code.`,
      "destination.countryCode",
    );
  }

  const kilograms = parseNumber(row["weight.kg"]);
  const weightGrams = kilograms === undefined ? undefined : Math.round(kilograms * 1000);
  if (row["weight.kg"] !== "" && (weightGrams === undefined || weightGrams < 1)) {
    fail(
      "weight-invalid",
      `Line ${line}: weight.kg "${row["weight.kg"]}" is not a positive weight.`,
      "weight.kg",
    );
  }

  const quantity = parseNumber(row.quantity);
  if (
    row.quantity !== "" &&
    (quantity === undefined || !Number.isInteger(quantity) || quantity <= 0)
  ) {
    fail(
      "number-invalid",
      `Line ${line}: quantity "${row.quantity}" is not a positive whole number.`,
      "quantity",
    );
  }

  const contents = parseContents(row.contents);
  const units = contents.reduce((total, part) => total + part.quantity, 0);
  if (contents.length > 0 && quantity !== undefined && units !== quantity) {
    warn(
      "quantity-mismatch",
      `Line ${line}: contents add up to ${units} units, quantity says ${quantity}.`,
      "contents",
    );
  }

  const recipient = {
    name: row["destination.name"],
    ...(row["destination.company"] !== "" && { company: row["destination.company"] }),
    line1: row["destination.address1"],
    ...(row["destination.address2"] !== "" && { line2: row["destination.address2"] }),
    city: row["destination.city"],
    ...(row["destination.province"] !== "" && { state: row["destination.province"] }),
    ...(row["destination.zip"] !== "" && { postalCode: row["destination.zip"] }),
    countryCode,
    ...(row["destination.phone"] !== "" && { phone: row["destination.phone"] }),
    ...(row["destination.email"] !== "" && { email: row["destination.email"] }),
  };

  let customs: Shipment["customs"];
  if (/^[A-Z]{2}$/.test(countryCode) && requiresCustomsDeclaration({ recipient })) {
    const currency = row.currencyCode.toUpperCase();
    const amount = parseNumber(row.declaredValue);
    if (row.declaredValue === "" || currency === "") {
      fail(
        "declared-value-required",
        `Line ${line}: declaredValue and currencyCode are required outside the EU.`,
        row.declaredValue === "" ? "declaredValue" : "currencyCode",
      );
    } else if (amount === undefined || amount < 0) {
      fail(
        "number-invalid",
        `Line ${line}: declaredValue "${row.declaredValue}" is not an amount.`,
        "declaredValue",
      );
    } else {
      customs = {
        category: "sale_of_goods",
        currency,
        declaredValue: { amount, currency },
        ...(row.taxReference !== "" && { taxReference: row.taxReference }),
      };
    }
  }

  if (issues.length > before && issues.slice(before).some((issue) => issue.level === "error")) {
    return undefined;
  }

  const items: Item[] = contents.map((part, index) => ({
    description: part.description,
    quantity: part.quantity,
    ...(index === 0 && row.harmonizedSystemCode !== "" && { hsCode: row.harmonizedSystemCode }),
    ...(index === 0 &&
      row.countryCodeOfOrigin !== "" && {
        originCountryCode: row.countryCodeOfOrigin.toUpperCase(),
      }),
  }));
  const candidate = {
    orderId: row.orderName,
    recipient,
    parcel: { weightGrams },
    items,
    ...(customs !== undefined && { customs }),
    ...(row["deliveryMethod.additionalInformation.instructions"] !== "" && {
      deliveryInstructions: row["deliveryMethod.additionalInformation.instructions"],
    }),
    sourceRows: [line],
  };
  const parsed = ShipmentSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      fail("schema", `Line ${line}: ${issue.path.join(".")}: ${issue.message}`);
    }
    return undefined;
  }
  return parsed.data;
}

export function parseRows(text: string): RowParseResult {
  const issues: RowIssue[] = [];
  const lines = splitClipboard(text);
  if (lines.length === 0) {
    issues.push({
      level: "error",
      code: "empty-paste",
      message: "Paste the row copied at the Make label step.",
    });
    return { shipments: [], rows: 0, issues };
  }
  const headerCells = lines[0] ?? [];
  if (!isHeader(headerCells)) {
    issues.push({
      level: "error",
      code: "header-required",
      message:
        "The first line must be the header (it names orderName); copy the row again with F11.",
      line: 1,
    });
    return { shipments: [], rows: 0, issues };
  }
  const header = readHeader(headerCells);
  const missing = new Set<RowField>(REQUIRED_FIELDS.filter((field) => !header.has(field)));
  const dataLines = lines.slice(1);
  if (dataLines.length === 0) {
    issues.push({
      level: "error",
      code: "empty-paste",
      message: "The paste has a header but no row.",
    });
    return { shipments: [], rows: 0, issues };
  }

  const shipments: Shipment[] = [];
  dataLines.forEach((cells, index) => {
    const line = index + 2;
    if (cells.length > headerCells.length) {
      issues.push({
        level: "error",
        code: "cell-count",
        message: `Line ${line} has ${cells.length} cells, the header has ${headerCells.length}.`,
        line,
      });
      return;
    }
    const shipment = parseLine({ line, row: toRecord(header, cells), missing, issues });
    if (shipment !== undefined) {
      shipments.push(shipment);
    }
  });
  return { shipments, rows: dataLines.length, issues };
}
