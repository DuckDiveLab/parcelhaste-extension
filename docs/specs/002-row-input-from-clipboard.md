---
id: "002"
title: Row input from clipboard
status: approved
---

# Row input from clipboard

Revision 2, 2026-10-17: the maintainer supplied the real row contract, produced by the order
tool at its "Make label" step. It replaces the provisional Cyprus Post workbook layout of
revision 1 and was approved by the maintainer's message that defined it.

## Context

The primary flow: at the "Make label" step of the order tool, F11 copies one shipment's row to
the clipboard; the packer pastes it into the side panel and presses Create. F11 is available from
"Make label" on, so the weight is always known. Batch by file is spec 008.

## Scope

In: parsing the pasted text into one `Shipment` with a validation report, the field list, the
side-panel view model that enables Create. Out: submitting to a carrier (003, 004), files (008),
SKU profiles (006), cleaning values for a carrier's form (the adapter's job).

## The row contract

- Tab-separated: a header line, then one line per shipment. The n-th value belongs to the n-th
  header name; an empty value is an empty cell, so a trailing empty field ends the line with a tab.
- Values are one line. The producer turns tabs and line breaks inside a value into one space and
  changes nothing else: no transliteration, no shortening.
- The header is the contract. Values are found by name, never by position. Fields are only ever
  added at the end and a name never changes meaning; unknown names are ignored; a known name
  missing from the header reads as empty.

| # | Field | Value | Shipment field |
|---|---|---|---|
| 1 | `orderName` | the order's reference | `orderId` |
| 2 | `destination.name` | | `recipient.name` |
| 3 | `destination.company` | | `recipient.company` |
| 4 | `destination.address1` | | `recipient.line1` |
| 5 | `destination.address2` | | `recipient.line2` |
| 6 | `destination.zip` | | `recipient.postalCode` |
| 7 | `destination.city` | | `recipient.city` |
| 8 | `destination.province` | | `recipient.state` |
| 9 | `destination.countryCode` | ISO alpha-2 | `recipient.countryCode` (`UK` → `GB`) |
| 10 | `destination.phone` | | `recipient.phone` |
| 11 | `destination.email` | | `recipient.email` |
| 12 | `deliveryMethod.additionalInformation.instructions` | delivery instructions | `deliveryInstructions` |
| 13 | `weight.kg` | parcel weight in kg, three decimals (`0.214`) | `parcel.weightGrams` (× 1000, rounded) |
| 14 | `quantity` | units in the parcel | checked against the item quantities |
| 15 | `contents` | each line's customs description with its quantity, `Washer nozzle x1, Cap x2` | `items[].description`, `items[].quantity` |
| 16 | `harmonizedSystemCode` | the product's (the first line's if several) | `items[0].hsCode` |
| 17 | `countryCodeOfOrigin` | the product's (the first line's if several) | `items[0].originCountryCode` |
| 18 | `declaredValue` | Σ (declared unit value, else price) × quantity plus the delivery price, in the currency's decimals; empty when unknown | `customs.declaredValue.amount` |
| 19 | `currencyCode` | the order's | `customs.currency`, `customs.declaredValue.currency` |
| 20 | `taxReference` | the order's IOSS or similar, if any | `customs.taxReference` |

Example (`⇥` is a tab; the empty company, address 2, province and tax reference show as adjacent
tabs, and the line ends in a tab): see `fixtures/rows/make-label.tsv`.

## Acceptance criteria (EARS)

- **AC-002-1** When the user pastes text, the parser shall split it into lines on CR, LF or CRLF
  and cells on tabs, ignore empty trailing lines, and read a line that ends in a tab as ending
  with an empty cell.
- **AC-002-2** If the first line does not contain the name `orderName`, then the parser shall
  report the error `header-required` and produce no shipment.
- **AC-002-3** The parser shall take every value by its header name, ignore names it does not
  know, and read a known name missing from the header as an empty value.
- **AC-002-4** If a data line has more cells than the header, then the parser shall report the
  error `cell-count` naming the line and both counts and produce no shipment for that line;
  fewer cells shall read as empty trailing values.
- **AC-002-5** The parser shall produce one shipment per data line and tag every issue with its
  line number, the header being line 1.
- **AC-002-6** If a required value is empty (`orderName`, `destination.name`,
  `destination.address1`, `destination.city`, `destination.countryCode`, `weight.kg`,
  `quantity`, `contents`), then the parser shall report an error naming the line and the field,
  and produce no shipment for that line.
- **AC-002-7** When `destination.phone`, `destination.email` or `destination.zip` is empty, the
  parser shall produce the shipment and report a warning naming the field.
- **AC-002-8** The parser shall uppercase `destination.countryCode`, map `UK` to `GB`, and report
  an error for any value that is not two letters.
- **AC-002-9** The parser shall read `weight.kg` as kilograms and store whole grams (`0.012` →
  12); when it is not a positive number, or rounds to zero grams, it shall report the error
  `weight-invalid`.
- **AC-002-10** If `quantity` is not a positive whole number, then the parser shall report an
  error naming the field and produce no shipment for that line.
- **AC-002-11** The parser shall split `contents` on commas into items, read a trailing ` xN` as
  the item quantity and default to 1, keep each description verbatim, attach
  `harmonizedSystemCode` and `countryCodeOfOrigin` to the first item only, and report the warning
  `quantity-mismatch` when the item quantities do not add up to `quantity`.
- **AC-002-12** When the destination is outside the EU, the parser shall set `customs` with
  category `sale_of_goods`, the currency, `declaredValue` from `declaredValue` and `currencyCode`,
  and `taxReference` when present; if `declaredValue` or `currencyCode` is empty outside the EU,
  then it shall report the error `declared-value-required`; inside the EU it shall leave
  `customs` unset.
- **AC-002-13** The parser shall copy `destination.company` to `recipient.company`,
  `destination.province` to `recipient.state`, `destination.address2` to `recipient.line2` and the
  delivery instructions to `deliveryInstructions`, trimming surrounding whitespace and changing
  nothing else.
- **AC-002-14** The field list in `src/inputs/column-map.ts` shall be the only place that names
  header fields, so that a new field changes that list only.
- **AC-002-15** When exactly one data line was pasted and it parsed, the panel view model shall
  expose recipient name, country code, weight in grams and unit count and set `canCreate` true;
  when no line parsed, or more than one data line was pasted, it shall expose the report
  (`one-row-per-paste` for several lines) and set `canCreate` false.
- **AC-002-16** If a value passes the field checks but the Shipment schema rejects it (for example
  a malformed email), then the parser shall report a `schema` error for that line.

The pasted text stays in the panel's memory for the session and is never logged or written to
extension storage (a rule for the build, not a testable criterion).

## Open questions

- `declaredValue` includes the delivery price. Is that the value to declare on CN22/CN23, or the
  goods value only? Until known the adapter declares it as given.
- Lines in `contents` after the first have no HS code or origin; spec 006 (SKU profiles) fills
  them.
- Does `destination.countryCode` ever carry `UK`? It is mapped to `GB` defensively.

## Test plan

- `src/inputs/row.test.ts`: AC-002-1 to AC-002-13, AC-002-16, with
  `fixtures/rows/make-label.tsv`.
- `src/inputs/column-map.test.ts`: AC-002-14.
- `src/inputs/row-view.test.ts` (pure view model, no DOM): AC-002-15.
