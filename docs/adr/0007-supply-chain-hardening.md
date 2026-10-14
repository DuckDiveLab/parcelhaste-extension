# ADR-0007: Supply-chain hardening for Bun

- Status: accepted
- Date: 2026-10-14

## Context

Bun's install defaults are weaker than pnpm 11's: it trusts a built-in allowlist of packages for
lifecycle scripts and installs freshly published versions immediately. Agents also run
`npm install` out of habit, leaving foreign lockfiles behind.

## Decision

- `bunfig.toml`: `[install] minimumReleaseAge = 259200` (3 days in seconds). A version published
  more recently is not installed; `bun add` resolves to the newest older one. Verified on
  2026-10-14: `bun add zod` resolved 4.6.5 although 4.6.7 was two days old.
- `trustedDependencies` is set explicitly. The current Bun docs state: "Defining
  `trustedDependencies` in package.json **replaces** the default list rather than extending it";
  an empty array means no package runs lifecycle scripts. We set `[]`. esbuild's `postinstall` is
  blocked and not needed: its platform binary arrives as an optional dependency, verified by
  building with it.
- `[install] exact = true`: package.json pins exact versions; the lockfile pins the tree.
- Only the text lockfile `bun.lock` is committed; `bun.lockb`, `package-lock.json`,
  `npm-shrinkwrap.json`, `pnpm-lock.yaml` and `yarn.lock` fail harness-check.
- CI installs with `bun install --frozen-lockfile`.
- Dependabot updates the `bun` and `github-actions` ecosystems weekly, grouped, with a 3-day
  cooldown. GitHub Actions are pinned by commit SHA.
- `packageManager` must be a pinned `bun@x.y.z`; harness-check enforces it, and `oven-sh/setup-bun`
  reads it in CI.

## Consequences

- A new dependency that needs an install script must be added to `trustedDependencies` with a
  review (CODEOWNERS routes package.json to maintainers).
- Urgent security fixes younger than 3 days need `minimumReleaseAgeExcludes` for that package, in a
  reviewed PR.
