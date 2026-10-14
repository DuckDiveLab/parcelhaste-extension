# ADR-0006: Tooling: Biome, Node test runner, zod, own scripts instead of frameworks

- Status: accepted (rewritten 2026-10-14 after the stack review; re-acceptance by the maintainer
  pending)
- Date: 2026-10-14

## Context

See ADR-0002 for the measurements. The original list was Biome, Vitest, Playwright, zod,
dependency-cruiser, lefthook and commitlint. Three of those are large dependency trees for small
jobs, and dependency-cruiser refuses TypeScript 7 ("support for typescript@>=7 will follow when its
API is published").

## Decision

| Job | Tool | Why |
|---|---|---|
| Lint and format | Biome (one binary) | No plugin tree; formatter and linter agree |
| Type check | `tsc --noEmit`, two configs (browser and Node) | Browser code never sees Node types |
| Unit tests | `node --test` with `node:assert/strict` | Built into Node 24; runs `.ts` directly |
| Schema and validation | zod | The one runtime dependency; types derive from schemas |
| Build and zips | `scripts/build.ts` on the esbuild API, `scripts/lib/zip.ts` on `zlib` | One dependency, deterministic archives |
| Import boundaries | `scripts/harness/check-imports.ts` | 150 tested lines; no TS-version coupling |
| Git hooks | `.githooks/` + `core.hooksPath` set by the `prepare` script | No tool needed |
| Commit messages | `scripts/lib/commit-message.ts`, in the hook and in CI | A regex, not 48 packages |
| End-to-end | Playwright, added with spec 003, CI-only | Nothing to test end to end yet |

Rejected: WXT and Vite (ADR-0002), React, Vitest, dependency-cruiser, lefthook, commitlint, and
web-ext (no Firefox target).

## Consequences

- `bun run check` runs Biome, tsc, the Node test runner and harness-check in that order.
- Test files carry the acceptance-criterion ID in the test name; harness-check links them to specs.
- When Node 26 becomes Active LTS the pins in `engines.node`, `.node-version` and CI move together.
- If dependency-cruiser gains TypeScript 7 support it can replace the import check; not before.
