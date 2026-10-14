# Inputs

Parsers that turn user input into a `Shipment` plus a validation report. May import `src/core` only.

- `column-map.ts`: the export's 22 columns, the only place that knows cell positions (spec 002).
- `row.ts`: `parseExportRows(text, { weight })` → `{ shipment?, issues }`. Errors block, warnings
  inform. `splitClipboard`, `parseNumber` and `parseWeightGrams` are exported for reuse.
- `row-view.ts`: `rowViewModel(result)` → what the panel shows and whether Create is enabled.
- Batch file (.tsv / .xlsx): roadmap, see `docs/specs/README.md` (spec 008).
