---
name: review
description: Self-review the diff against the spec, the AGENTS.md boundaries, the dependency rules and CONTEXT.md naming before opening a PR.
---

# Self-review

Run `git diff --stat main...HEAD` and read every changed file. Check, in this order:

1. Scope: every change traces to a criterion of the spec, or the PR is trivial and gets the
   `no-spec` label. Nothing extra slipped in.
2. Tests: every criterion has a test whose name contains its ID, and each test fails without the
   change.
3. Boundaries: no cross-carrier import; `src/core` touches no browser or Node API; browser code
   imports only packages from `dependencies`; nothing imports `entrypoints/`.
4. Naming: CONTEXT.md terms, used consistently. A new term is in CONTEXT.md.
5. Safety: no real order or customer data, no live portal calls, no secrets, no weakened check, no
   suppression without a reason.
6. Harness: AGENTS.md, CLAUDE.md, CONTEXT.md, `.agents/`, `.claude/`, `.github/`, configs and
   `scripts/` untouched unless the task is about them.
7. Dependencies: none added. If one was unavoidable, the PR says why; a maintainer reviews it.
8. `bun run check` and `bun run build` are green locally.

Put the findings in the PR body as a checklist. Fix what you can before opening the PR.
