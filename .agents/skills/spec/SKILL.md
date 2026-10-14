---
name: spec
description: Interview the maintainer and write docs/specs/NNN-slug.md with EARS acceptance criteria and IDs, status draft. Use before any non-trivial change.
---

# Write a spec

Use when a change is non-trivial (AGENTS.md: more than 20 lines, more than one file, or anything in
`src/core` or `src/carriers/_contract`).

## Steps

1. Read CONTEXT.md and `docs/specs/README.md`. If the change is on the roadmap, use its number and
   title; otherwise take the next free number.
2. Interview the maintainer, one question at a time, only what the spec needs:
   - What does the user do, and what do they see when it works?
   - Which inputs exist, which are optional, where do they come from?
   - What must never happen (wrong label, duplicate submission, lost data)?
   - What is out of scope? Which carrier, if any?
3. Write `docs/specs/NNN-slug.md` from the template below with `status: draft`. Never set
   `approved`; only the maintainer does.
4. Add the spec to the index in `docs/specs/README.md`.
5. Give every acceptance criterion an ID `AC-NNN-n`. Each one must be checkable by one test.

## Template

```markdown
---
id: "NNN"
title: <imperative title>
status: draft
carrier: <id>            # only for carrier specs
---

# <title>

## Context
Why now. Link ADRs and related specs.

## Scope
In and out.

## Acceptance criteria (EARS)
- **AC-NNN-1** The <system> shall <response>.                                 (ubiquitous)
- **AC-NNN-2** When <trigger>, the <system> shall <response>.                 (event-driven)
- **AC-NNN-3** While <state>, the <system> shall <response>.                  (state-driven)
- **AC-NNN-4** If <unwanted condition>, then the <system> shall <response>.   (unwanted behaviour)
- **AC-NNN-5** Where <feature is included>, the <system> shall <response>.    (optional feature)

## Open questions

## Test plan
Which test file covers which criterion.
```

## Rules

- One criterion, one observable behaviour. No "should", no "etc.", no implementation detail.
- Use CONTEXT.md terms; a new term goes into CONTEXT.md in the same PR.
- Decisions that outlive the spec go to `docs/adr/`, not into the spec.
