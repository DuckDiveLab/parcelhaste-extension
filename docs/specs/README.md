# Specs

One spec per non-trivial change, written with `.agents/skills/spec/SKILL.md`. Frontmatter fields:
`id`, `title`, `status` (draft → approved → implemented → superseded), optional `carrier`.
Acceptance criteria use EARS and carry IDs `AC-NNN-n`; a test with the ID in its name proves each
one. `harness-check` links criteria to tests for approved and implemented specs.

## Index

| Spec | Title | Status |
|---|---|---|
| [001](001-shipment-model-and-carrier-contract.md) | Shipment model and carrier adapter contract | draft |
| [002](002-row-input-from-clipboard.md) | Row input from clipboard | implemented |
| [004](004-queue-runner-and-error-handling.md) | Queue runner and error handling | implemented |

## Roadmap

| Spec | Title | Notes |
|---|---|---|
| 003 | Cyprus Post adapter, `http` strategy | Post the wizard's form body to Create from the portal tab instead of filling the wizard. The request recipe, rules and mapping gaps are in `src/carriers/cyprus-post/README.md`; the submit HAR and label PDF still need one real submit, and the logged-in form needs a CyLogin session. The official API is out of scope: the ParcelHaste server gateway implements it. |
| 005 | Label download and merged PDF | `ParcelHaste/<carrier-id>/<YYYY-MM-DD>/<order-id>_<tracking>.pdf`; merged PDF needs ADR-0008. |
| 006 | SKU profiles and customs declarations | Stored weight, HS code, customs description, origin; auto-fill CN22/CN23. |
| 007 | Amazon shipping-confirmation export | Open question: needs `order-item-id`, which the current export does not contain. |
| 008 | Batch file input (.tsv / .xlsx) | Drop a file, validation preview, queue of many shipments. XLSX needs ADR-0009. |

The clipboard flow (002) is the primary path. Batch by file (008) is a later option.
