---
name: build
description: Implement an approved spec test-first and get bun run check green. Refuses to implement a spec whose status is not approved.
---

# Build an approved spec

1. Open the spec. If `status` is not `approved`, stop and say so. Draft specs are not implemented.
2. Read CONTEXT.md. Grep `docs/solutions/` for the tags of the modules you will touch.
3. For each acceptance criterion write a failing test first. The test name starts with the ID,
   e.g. `test("AC-002-3 rejects a row with a missing postcode", ...)`. Tests live next to the code
   in `*.test.ts` and use `node:test` with `node:assert/strict`.
4. Implement the smallest code that passes. Respect the boundaries in AGENTS.md.
5. Run `bun run check` and fix everything it reports. Never weaken a check to get green.
6. When every criterion passes, set the spec to `status: implemented` in the same PR.
7. Open the PR from the template: `Spec: NNN`, the criteria checklist with test files, the agent
   used, and the confirmation that `bun run check` passed.
8. Then follow `.agents/skills/compound/SKILL.md`.

## Rules

- Fixtures are synthetic. Never call a live portal from tests.
- A carrier change stays inside `src/carriers/<id>/`; shared needs become a spec for `src/core`.
- If the spec turns out wrong or incomplete, stop, write what is missing in the PR, and ask. Do not
  widen the scope on your own.
