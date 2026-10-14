# ADR-0008: PDF merge library

- Status: proposed (deferred until batch input exists; see docs/specs/README.md, spec 005)
- Date: 2026-10-14

## Context

Spec 005 wants one merged PDF per run so a batch prints as a single job. Merging PDFs in the
browser needs a library; the extension otherwise has one runtime dependency.

## Options

- pdf-lib: pure JavaScript, no workers, copies pages between documents; the default proposal.
- No merge: print each label as it arrives; a batch of n labels is n print dialogs.
- A tiny merge written on our own: PDF object streams make this larger than it looks.

## Decision

Default pdf-lib, to be decided by the maintainer when spec 005 is written. Until then the
extension has no PDF dependency and the clipboard flow prints one label at a time.
