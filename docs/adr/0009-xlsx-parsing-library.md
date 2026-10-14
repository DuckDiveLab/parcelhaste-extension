# ADR-0009: XLSX parsing library

- Status: proposed (deferred until batch file input; see docs/specs/README.md, spec 008)
- Date: 2026-10-14

## Context

The first input is one TSV row from the clipboard, which needs no library. Batch input by file
(spec 008) would accept `.xlsx` exports and needs a parser that runs in the browser.

## Options

- read-excel-file: small, browser-first, reads one sheet into rows.
- exceljs: full featured, larger.
- xlsx (SheetJS community build): widely used, large, unusual release channel.
- Ask the export tool for TSV only and skip XLSX entirely.

## Decision

Deferred. The maintainer decides when spec 008 is written; the last option keeps the dependency
count at one and should be considered first.
