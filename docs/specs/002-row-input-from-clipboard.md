---
id: "002"
title: Row input from clipboard
status: draft
---

# Row input from clipboard

## Context

The primary flow: the user copies one row from the maintainer's export tool, pastes it into the
side panel, presses Create, and the extension does the rest. The row layout is provisional (22
columns, `fixtures/rows/provisional-22-columns.tsv`); the final layout arrives later from the
export tool, so the column mapping must live in one table. Batch by file is spec 008.

## Scope

In: parsing pasted text into one `Shipment` with a validation report, the column map, the side
panel state that enables Create. Out: submitting to a carrier (003, 004), files (008), SKU
profiles (006).

## Behaviour

Pasted text is split into rows on line breaks and cells on tabs. A header row equal to the column
map's header is skipped. All rows must share one order id; with `Multiple=TRUE` each row becomes
one item of the same shipment. The validation report lists errors (no shipment produced) and
warnings (shipment produced, user informed).

## Acceptance criteria (EARS)

- **AC-002-1** When the user pastes text, the parser shall split it into rows on line breaks and
  cells on tabs, ignoring a trailing empty line.
- **AC-002-2** When the first row equals the column map's header, the parser shall skip it.
- **AC-002-3** If a row's cell count differs from the column map, then the parser shall report an
  error naming the row, the expected and the actual count, and produce no shipment.
- **AC-002-4** When all rows share one order id, the parser shall produce exactly one `Shipment`
  with one `Item` per row, the recipient from the first row and the parcel weight from the first
  row.
- **AC-002-5** If the rows carry more than one order id, then the parser shall report the error
  "one order per paste" and produce no shipment.
- **AC-002-6** If a required cell is empty (recipient name, address line 1, city, country code,
  package weight, SKU, quantity), then the parser shall report an error naming the row and the
  column, and produce no shipment.
- **AC-002-7** When the phone, email or postal code cell is empty, the parser shall report a
  warning naming the column and still produce the shipment.
- **AC-002-8** The parser shall map the country code cell to `countryCode` in uppercase and reject
  anything that is not two letters.
- **AC-002-9** When the destination is outside the EU, the parser shall set `customs` with
  category `sale_of_goods` and the row's currency.
- **AC-002-10** The column map shall be one table in `src/inputs/`, so that a new row layout changes
  that table and nothing else.
- **AC-002-11** When parsing succeeds, the side panel shall show the recipient name, country, weight
  and item count and enable Create; when it fails, it shall show the report and keep Create
  disabled.
- **AC-002-12** The parser shall never log or persist the pasted text beyond the current panel
  session.

## Open questions

- The final row layout from the export tool (replaces the provisional 22 columns).
- Weight unit and decimal separator (see spec 001).
- Is the `Tracking number` column ever filled on input, and what should happen then?
- Does one paste ever contain several orders on purpose, as a mini batch?

## Test plan

- `src/inputs/row.test.ts`: AC-002-1 to AC-002-10, AC-002-12, with rows from
  `fixtures/rows/`.
- `src/inputs/row-view.test.ts` (pure view-model, no DOM): AC-002-11.
