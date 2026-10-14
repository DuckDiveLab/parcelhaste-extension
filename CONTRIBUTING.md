# Contributing

Thank you for helping. Contributions are accepted under the Apache-2.0 license.

## AI-assisted contributions

Welcome. Use any agent (Claude Code, Codex, Grok Build, Cursor, Copilot) or none. The human author
is responsible for the contribution: you have read it, you can explain it, and you ran the checks.
Say which agent you used in the pull request template.

## Rules

1. Follow [AGENTS.md](AGENTS.md). It is short on purpose; everything in it is enforced or matters.
2. Non-trivial changes start with a spec in `docs/specs/` (see
   `.agents/skills/spec/SKILL.md`). The maintainer approves it before implementation.
3. Run `bun run check` before pushing. CI runs the same gate plus the builds.
4. Never commit real order or customer data. Fixtures are synthetic (`fixtures/README.md`).
5. Package manager is Bun (`bun install`, `bun add`, `bunx`). Never `npm`, `pnpm` or `yarn`.
6. New dependencies need a maintainer review and a reason in the PR.
7. Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, ...). A git hook checks
   them; so does CI.

## Pull requests

Use the template. The body needs `Spec: NNN`, or the PR carries the `no-spec` label for trivial
changes. List the acceptance criteria with their tests, name the agent used, and confirm the gate.

## Adding a carrier

Follow `.agents/skills/add-carrier/SKILL.md` and `src/carriers/AGENTS.md`. You will need sanitized
fixtures from the carrier's portal; the Cyprus Post README lists what that means.

## Code of conduct

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) applies to every interaction in this project.
