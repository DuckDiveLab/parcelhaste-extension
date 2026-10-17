# The row contract: read by header name

Spec: 002 (revision 2) · PR: spec 002 re-implementation

## Problem

Revision 1 of spec 002 was implemented against a format taken from a neighbouring tool of the
maintainer's (a 22-column Cyprus Post workbook). The real clipboard row, produced by the order
tool at its "Make label" step, arrived afterwards: a header line plus 20 named, tab-separated
fields, read by name and never by position.

## What worked

- Keeping every position in one column map: the rewrite touched the map, the parser and the
  tests; the view model and the panel changed by a few lines.
- Reading values by header name. The producer may append fields and reorder nothing; the parser
  ignores names it does not know and treats a missing known name as empty.
- Tests named by acceptance criterion: when the spec gained AC-002-16, `harness-check` refused
  the approved spec until a test mentioned it.

## What failed

- Guessing an input format from a neighbouring tool. Ask for the sample row before implementing
  an input spec; a guessed format costs a full rewrite.

## Gotchas

- A line ends in a tab when its last field is empty; `split("\t")` yields the empty cell. A
  producer might drop trailing empties instead, so fewer cells than the header read as empty.
- `git rm` of the last file in a directory removes the directory; recreate it before writing the
  replacement fixture.
- The fixture scan read an IOSS number (`IM1234567890`) as a phone number. A digit run glued to
  letters is an identifier; the heuristic now skips it.
- `declaredValue` is the whole parcel including delivery. Whether CN22/CN23 wants that or the
  goods value only is an open question for spec 003.

## Tags

`module:inputs` `module:core` `tooling:harness`
