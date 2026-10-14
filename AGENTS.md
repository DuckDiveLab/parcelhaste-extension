# AGENTS.md

Canonical instructions for every coding agent and human contributor; CLAUDE.md only imports this file.
Vocabulary: CONTEXT.md. Decisions: `docs/adr/`. Intent: `docs/specs/`. Lessons: `docs/solutions/`.

## Commands

- Install: `bun install --frozen-lockfile` (Bun 1.4.3 pinned in `packageManager`, Node 24 for tools).
- Dev: `bun run dev` builds `dist/chrome-mv3/` and watches; load it unpacked in Chrome and press
  reload after changes. Chrome is the only target.
- The one gate: `bun run check` = `biome check` → `tsc --noEmit` (two configs) → `node --test` →
  `harness-check`. Tests alone: `bun run test`. Chrome zip: `bun run build`.
- After editing `.agents/skills/`: `bun run harness:sync` regenerates `.claude/skills/`.

## The loop

A change is non-trivial if it is more than 20 lines, touches more than one file, or touches
`src/core` or `src/carriers/_contract` at all.

- Non-trivial: write a spec with `.agents/skills/spec/SKILL.md` → the maintainer sets
  `status: approved` → implement test-first with `.agents/skills/build/SKILL.md` → `bun run check`
  → PR with `Spec: NNN` in the body → `.agents/skills/compound/SKILL.md`.
- Trivial: just do it. The PR gets the `no-spec` label.
- Before any PR: `.agents/skills/review/SKILL.md`. New carrier: `.agents/skills/add-carrier/SKILL.md`.

## Before coding

- Read CONTEXT.md and use its terms in code, tests and docs. A new term goes into CONTEXT.md in the
  same PR.
- Grep `docs/solutions/` for the tags of the modules you will touch (`module:core`, `carrier:<id>`).
- Unknown convention: stop and propose an ADR in `docs/adr/`. Do not invent one.

## Rules the tools cannot see

- Tests use Node's built-in runner: `*.test.ts` next to the code, `node:assert/strict`. Test-only
  helpers are named `testing.ts`. A test for an acceptance criterion starts with its ID: `AC-001-3`.
- Imports are relative and carry the `.ts` extension. Only erasable TypeScript syntax (no enums,
  namespaces or parameter properties): Node runs the files as written.
- `src/` and `entrypoints/` run in the browser: no Node modules, no Bun, only packages listed in
  `dependencies` (today: zod).
- UI is plain DOM in `entrypoints/`: one render function per view, no framework.
- Boundaries (harness-check enforces them): `src/core` imports only itself; `src/carriers/<id>`
  imports only itself, `src/core` and `src/carriers/_contract`; `src/inputs` and `src/outputs`
  import only `src/core`; nothing imports `entrypoints/`.
- Adapters reject only with `CarrierError`. The queue runs in the side panel, never in the
  background worker (ADR-0003).
- Fixtures are synthetic: emails on example.com, phones in reserved ranges (`fixtures/README.md`).

## Never

- implement a spec whose status is not `approved`;
- edit harness or config files (AGENTS.md, CLAUDE.md, CONTEXT.md, `.agents/`, `.claude/`,
  `.github/`, `.githooks/`, `biome.jsonc`, `tsconfig*.json`, `scripts/`, `package.json`,
  `bunfig.toml`) unless the task is about them;
- weaken a check: disable a rule, skip a test, loosen a tsconfig, or add a suppression without a
  reason;
- import across carriers;
- commit real order or customer data, or anything captured from a real carrier session;
- call a live carrier portal from tests;
- install, add or run packages with `npm`, `npx`, `pnpm` or `yarn`: use `bun install`, `bun add`
  and `bunx`;
- use `bun test` or Bun-only APIs in `src/` or `scripts/`;
- hand-edit `.claude/skills/` or `bun.lock`.

## Done

`bun run check` is green, and every acceptance criterion of the spec has a passing test whose name
contains its ID. The PR body has `Spec: NNN` or the PR carries the `no-spec` label, names the agent
used, and confirms that `bun run check` passed.
