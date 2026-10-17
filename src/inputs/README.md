# Inputs

Parsers that turn user input into a `Shipment` plus a validation report. May import `src/core` only.

- `column-map.ts`: the row contract's 20 field names, read by header name (spec 002).
- `row.ts`: `parseRows(text)` → `{ shipments, rows, issues }`, one shipment per parsed line.
  Errors block, warnings inform. `splitClipboard`, `parseNumber` and `parseContents` are
  exported for reuse.
- `row-view.ts`: `rowViewModel(result)` → what the panel shows and whether Create is enabled.
- Batch file (.tsv / .xlsx): roadmap, see `docs/specs/README.md` (spec 008).
