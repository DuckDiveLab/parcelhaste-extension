// The Shipment model: the one data contract shared by inputs, carriers and outputs.
// Designed in docs/specs/001-shipment-model-and-carrier-contract.md. Vocabulary: CONTEXT.md.
import { z } from "zod";

/** ISO 3166-1 alpha-2, uppercase. */
export const CountryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "must be an ISO 3166-1 alpha-2 country code");

/** ISO 4217, uppercase. */
export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, "must be an ISO 4217 code");

/** Amount in major units with at most two decimals, e.g. 12.5 EUR. */
export const MoneySchema = z.object({
  amount: z
    .number()
    .nonnegative()
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
      message: "must have at most two decimals",
    }),
  currency: CurrencyCodeSchema,
});

export const AddressSchema = z.object({
  name: z.string().trim().min(1),
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional(),
  line3: z.string().trim().optional(),
  city: z.string().trim().min(1),
  /** State, province or region. Required by some carriers for some countries. */
  state: z.string().trim().optional(),
  /** Optional because some countries have no postal codes. */
  postalCode: z.string().trim().optional(),
  countryCode: CountryCodeSchema,
  phone: z.string().trim().optional(),
  email: z.email().optional(),
});

export const ItemSchema = z.object({
  sku: z.string().trim().min(1),
  /** Customs description when declared; falls back to the product name. */
  description: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unitPrice: MoneySchema,
  unitWeightGrams: z.number().int().nonnegative().optional(),
  /** Harmonized System code, 6 to 10 digits. */
  hsCode: z
    .string()
    .regex(/^\d{6,10}$/)
    .optional(),
  originCountryCode: CountryCodeSchema.optional(),
});

export const ParcelSchema = z.object({
  weightGrams: z.number().int().positive(),
  lengthCm: z.number().positive().optional(),
  widthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
});

/** CN22 / CN23 "category of item". */
export const CustomsCategorySchema = z.enum([
  "sale_of_goods",
  "gift",
  "commercial_sample",
  "documents",
  "returned_goods",
  "other",
]);

/** Declaration-level customs fields. Declaration lines are derived from `items`. */
export const CustomsInfoSchema = z.object({
  category: CustomsCategorySchema,
  currency: CurrencyCodeSchema,
  /** Required by the forms when category is "other". */
  explanation: z.string().trim().optional(),
  invoiceNumber: z.string().trim().optional(),
});

export const ShipmentSchema = z.object({
  /** Order identifier from the source system. Several items may share one order. */
  orderId: z.string().trim().min(1),
  recipient: AddressSchema,
  parcel: ParcelSchema,
  items: z.array(ItemSchema).min(1),
  shippingPrice: MoneySchema.optional(),
  /** Required for destinations outside the EU customs territory. */
  customs: CustomsInfoSchema.optional(),
  /** Provenance: which input rows produced this shipment (1-based). */
  sourceRows: z.array(z.number().int().positive()).optional(),
});

export type CountryCode = z.infer<typeof CountryCodeSchema>;
export type Money = z.infer<typeof MoneySchema>;
export type Address = z.infer<typeof AddressSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Parcel = z.infer<typeof ParcelSchema>;
export type CustomsCategory = z.infer<typeof CustomsCategorySchema>;
export type CustomsInfo = z.infer<typeof CustomsInfoSchema>;
export type Shipment = z.infer<typeof ShipmentSchema>;

/** EU member states. The sender is in Cyprus, so these need no customs declaration. */
export const EU_COUNTRY_CODES: ReadonlySet<string> = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

/**
 * Whether a shipment needs a CN22/CN23 declaration. Special territories inside EU
 * members but outside the customs union (Canary Islands, Åland, ...) are not handled
 * yet (verify in spec 006).
 */
export function requiresCustomsDeclaration(shipment: Pick<Shipment, "recipient">): boolean {
  return !EU_COUNTRY_CODES.has(shipment.recipient.countryCode);
}
