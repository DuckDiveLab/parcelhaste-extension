# Clipboard rows from the Excel export

Spec: 002 · PR: spec 002 implementation

## Problem

Turn one order's row(s), copied from the Cyprus Post shipping export in Excel, into a
`Shipment` with a validation report, without knowing in advance how Excel formats the cells.

## What worked

- One header list (`src/inputs/column-map.ts`) as the single source of cell positions; the
  parser reads cells by name. The test asserts the list equals the fixture header.
- Collecting every error before giving up, so the packer sees all problems of a paste at once,
  and running the zod schema last as a safety net for anything the explicit checks missed.
- A typed weight that overrides the cell, since the export leaves `Package weight` empty.

## What failed

- The first fixture row had quantity 2 with `item-price` 12.50 as if it were a unit price. The
  approved assumption is that `item-price` is the line total, and the AC-002-4 test caught the
  inconsistency. Fixture data must follow the spec's assumptions, not intuition.

## Gotchas

- Excel copies displayed text. In EU locales decimals come with a comma (`12,50`), so
  `parseNumber` accepts both. Trailing newlines are normal; the header may or may not be there.
- `harness-check` demands a test for every criterion of an approved spec. Approving a spec by
  editing its status on `main` therefore turns `main` red until the implementation lands. The way
  through: record `status: approved` in the first commit of the implementing PR and
  `status: implemented` in the last. AGENTS.md should say so (proposed, not yet applied).
- `exactOptionalPropertyTypes` rejects `{ phone: undefined }`; build optional fields with
  conditional spreads (`...(value !== "" && { phone: value })`).

## Tags

`module:inputs` `module:core` `tooling:harness`
