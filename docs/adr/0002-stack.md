# ADR-0002: Stack: TypeScript, esbuild, plain DOM, Bun as package manager, Node as runtime

- Status: accepted (rewritten 2026-10-14 after the stack review; re-acceptance by the maintainer
  pending)
- Date: 2026-10-14

## Context

The first version of this ADR chose WXT (Vite), React, Vitest and Playwright. The maintainer asked
why a browser extension needs that many dependencies. Measured on 2026-10-14 (`bun add` into an
empty project, packages that land in `node_modules`):

| Tool | Packages |
|---|---|
| WXT, React, Vitest, Playwright, dependency-cruiser, lefthook, commitlint, Biome, web-ext, zod | 371 |
| WXT alone | 96 |
| web-ext | 257 |
| commitlint | 48 |
| dependency-cruiser | 44 |
| Vitest | 25 |
| React + react-dom | 3 |
| esbuild, TypeScript, Biome, zod | 1 each |

Runtime code runs inside the user's logged-in carrier session; dev dependencies run on maintainer
machines and in CI with repository credentials. Both trees matter. WXT is still 0.x with breaking
changes at minor versions and adds auto-import magic. React buys nothing for a side panel with a
paste box, a button and a status list. Node 24 runs TypeScript test files directly with its
built-in test runner.

## Decision

- Language: TypeScript, strict, latest stable (7.x, the native compiler). Only erasable syntax
  (`erasableSyntaxOnly`), relative imports with the `.ts` extension, so Node runs the files
  as written and esbuild bundles them without a transform step.
- Bundler: esbuild through its JS API in `scripts/build.ts`. One manifest definition rendered per
  browser (`scripts/lib/manifest.ts`), zips written by `scripts/lib/zip.ts` on Node's `zlib`.
  Output is unminified so store reviewers can read it.
- Targets: Chrome MV3 primary; Firefox and Edge built from the same code. Firefox uses
  `background.scripts` and `sidebar_action`, Chrome `service_worker` and `side_panel`.
- UI: plain DOM in `entrypoints/`, one render function per view, no framework. Reassess only if
  the UI outgrows this; the next step would be Preact, not React.
- Runtime dependency: zod only, for the Shipment schema shared by inputs, carriers and tests.
- Package manager and script runner: Bun, pinned in `packageManager`. Runtime for tools: Node,
  Active LTS (24 today; 26 becomes Active LTS on 2026-10-28), pinned in `engines.node` and
  `.node-version`. Scripts run tools normally, never `bun --bun`.
- Tests: Node's built-in runner (`node --test`), not `bun test` and not Vitest. `src/` and
  `scripts/` never use Bun-only APIs.

## Consequences

- Four dev dependencies (TypeScript, esbuild, Biome, type packages) instead of hundreds.
- No hot reload: `bun run dev` watches and rebuilds; the developer presses reload on the
  extensions page.
- About 350 lines of our own build and harness scripts, each tested, instead of framework
  configuration.
- Playwright is added when the first real adapter exists (spec 003), CI-only.
