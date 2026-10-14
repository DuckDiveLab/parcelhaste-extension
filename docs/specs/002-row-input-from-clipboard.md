---
id: "002"
title: Row input from clipboard
status: implemented
---

# Row input from clipboard

## Context

The primary flow: the packer copies one order's row (or rows) from the Cyprus Post shipping
export, pastes it into the side panel, presses Create, and the extension does the rest. The
export is an Excel workbook produced by the maintainer's "Cyprus Post Shipping Export" tool from
the Amazon FBM order reports; copying cells from Excel puts tab-separated text on the clipboard.
The exact layout is below and in `fixtures/rows/cyprus-post-export.tsv`. Batch by file is spec
008.

## Scope

In: parsing pasted text into one `Shipment` with a validation report, the column map, the weight
rule, the side-panel view model that enables Create. Out: submitting to a carrier (003, 004),
files (008), SKU profiles (006).

## The export row

22 tab-separated cells, header names exact. What the export guarantees, from its generator:

| # | Header | Content | Shipment field |
|---|---|---|---|
| 1 | `Tracking number` | empty until shipped | must be empty |
| 2 | `Multiple` | `TRUE` when the order has several SKUs, else `FALSE` | ignored (derived from rows) |
| 3 | `order-id` | Amazon order id | `orderId` |
| 4 | `ship-country` | country name, or the code when unknown | ignored (display only) |
| 5 | `Package weight` | empty in the export; the packer may type it in Excel | `parcel.weightGrams`, see weight rule |
| 6 | `product-name` | English, "Click&Fit" prefix removed | `items[].description` |
| 7 | `SKU` | | `items[].sku` |
| 8 | `quantity-purchased` | integer | `items[].quantity` |
| 9 | `currency` | always `EUR` | `items[].unitPrice.currency`, `customs.currency` |
| 10 | `item-price` | line total in EUR, 2 decimals (verify: total, not unit) | `items[].unitPrice.amount` = item-price ÷ quantity |
| 11 | `shipping-price` | EUR, 2 decimals | `shippingPrice` |
| 12 | `postage-item-price` | Excel formula item-price − shipping-price; Excel pastes the value | ignored (verify meaning) |
| 13 | `buyer-phone-number` | `+<calling code><number>` when the country is known | `recipient.phone` |
| 14 | `buyer-email` | | `recipient.email` |
| 15 | `recipient-name` | Title Case | `recipient.name` |
| 16 | `ship-postal-code` | zero-padded for DE FR IT ES PL (5) and AT BE LU CH NL DK HU SI (4) | `recipient.postalCode` |
| 17 | `ship-city` | Title Case | `recipient.city` |
| 18 | `ship-state` | may be empty | `recipient.state` |
| 19 | `ship-address-1` | Spanish addresses abbreviated | `recipient.line1` |
| 20 | `ship-address-2` | may be empty | `recipient.line2` |
| 21 | `ship-address-3` | may be empty | `recipient.line3` |
| 22 | `ship-country-code` | ISO alpha-2; Amazon uses `UK` for the United Kingdom | `recipient.countryCode` (`UK` → `GB`) |

Numbers may arrive as Excel displays them (`12.5` or `12.50`). Empty cells are empty strings.

## Weight rule

The export leaves `Package weight` empty, because the parcel is weighed when it is packed. The
panel therefore accepts a weight typed by the packer. A value below 50 is kilograms (`0.25` →
250 g), otherwise grams (`250`). Nothing ships below 50 g untracked or above 50 kg, so the two
never overlap (verify with the maintainer; CONTEXT.md marks the unit).

## Acceptance criteria (EARS)

- **AC-002-1** When the user pastes text, the parser shall split it into rows on CR, LF or CRLF
  and cells on tabs, ignoring empty trailing lines.
- **AC-002-2** When the first row equals the export header (22 names in order), the parser shall
  skip it.
- **AC-002-3** If a row has a cell count other than 22, then the parser shall report an error
  naming the row number, the expected and the actual count, and produce no shipment.
- **AC-002-4** When every row shares one order id, the parser shall produce exactly one
  `Shipment` with the recipient and shipping price from the first row and one `Item` per row
  (SKU, product name as description, quantity, unit price = item-price ÷ quantity rounded to 2
  decimals, currency from the row).
- **AC-002-5** If the rows carry more than one order id, then the parser shall report the error
  `one order per paste` and produce no shipment.
- **AC-002-6** If a required cell is empty (`order-id`, `SKU`, `quantity-purchased`,
  `product-name`, `recipient-name`, `ship-address-1`, `ship-city`, `ship-country-code`), then the
  parser shall report an error naming the row and the column, and produce no shipment.
- **AC-002-7** When `buyer-phone-number`, `buyer-email` or `ship-postal-code` is empty, the parser
  shall produce the shipment and report a warning naming the column.
- **AC-002-8** The parser shall uppercase `ship-country-code`, map `UK` to `GB`, and report an
  error for any value that is not two letters.
- **AC-002-9** When the recipient country is outside the EU, the parser shall set `customs` with
  category `sale_of_goods` and the row's currency; inside the EU it shall leave `customs` unset.
- **AC-002-10** If `Package weight` is empty and no weight was typed in the panel, then the parser
  shall report the error `weight required` and produce no shipment; when a weight was typed it
  shall take precedence over the cell.
- **AC-002-11** When the weight value is below 50, the parser shall read it as kilograms and store
  grams; when it is 50 or more, as grams; when it is not a positive number, it shall report an
  error.
- **AC-002-12** If `Tracking number` is not empty in any row, then the parser shall report the
  error `already shipped` and produce no shipment.
- **AC-002-13** If the rows of one order differ in `recipient-name`, `ship-address-1`,
  `ship-postal-code` or `ship-country-code`, then the parser shall report an error naming the
  column and produce no shipment.
- **AC-002-14** The column map shall be one table in `src/inputs/` keyed by header name, and the
  parser shall take every cell position from it, so that a new layout changes the table only.
- **AC-002-15** When parsing succeeds, the panel view model shall expose the recipient name,
  country code, weight in grams and item count and set `canCreate` true; when it fails, it shall
  expose the report and set `canCreate` false.

The pasted text stays in the panel's memory for the session and is never logged or written to
extension storage (a rule for the build, not a testable criterion).

## Open questions

- `item-price`: line total or unit price? The Amazon report gives the line total; confirm.
- `postage-item-price`: what is it for? Ignored until known.
- Weight unit threshold of 50: confirm, or state the unit explicitly in Excel.
- May a paste ever contain several orders on purpose, as a mini batch?
- Should the panel remember the last weight for identical SKUs? (spec 006 territory)

## Test plan

- `src/inputs/row.test.ts`: AC-002-1 to AC-002-13, with rows from
  `fixtures/rows/cyprus-post-export.tsv`.
- `src/inputs/column-map.test.ts`: AC-002-14.
- `src/inputs/row-view.test.ts` (pure view model, no DOM): AC-002-15.
