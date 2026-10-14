# ADR-0001: AGENTS.md is the single source of truth for agents

- Status: accepted
- Date: 2026-10-14

## Context

The project will be developed by many contributors using different coding agents (Claude Code,
Codex, Grok Build, Cursor, Copilot). Each agent reads a different context file by default, and
prose rules drift unless something enforces them. An ETH Zurich study (arXiv 2602.11988) found that
agents follow context-file instructions well, that repository overviews do not improve results,
and that context files add roughly 20% inference cost.

## Decision

- `AGENTS.md` is canonical for every agent: commands, the loop, non-obvious rules and hard
  boundaries only. No project overview, no directory tour. At most 120 lines.
- `CLAUDE.md` is a thin bridge whose first line is `@AGENTS.md`, at most 15 lines, Claude-only
  notes. Never a symlink: Grok Build loads both files and would see duplicate content. Every
  scoped `AGENTS.md` (for example `src/carriers/AGENTS.md`) has a sibling bridge.
- Workflows are Agent Skills in `.agents/skills/<name>/SKILL.md` (frontmatter `name` and
  `description`, plain markdown, at most 80 lines, no agent-specific features). `.claude/skills/` is
  a generated mirror (`bun run harness:sync`).
- Vocabulary lives in `CONTEXT.md`, intent in `docs/specs/`, decisions in `docs/adr/`, lessons in
  `docs/solutions/`. Each file type has one job and content never leaks between them.
- Enforcement lives in CI and `scripts/harness-check.ts`, not in prose.

## Consequences

- Agents without skill support still work: AGENTS.md references each skill by path.
- `harness-check` fails the build on every layout violation (line caps, missing bridges, stale
  mirror, invalid spec frontmatter, untested criteria, unknown criteria in tests).
- Adding a rule to AGENTS.md means removing or compressing another once the cap is reached.
