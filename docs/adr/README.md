# Architecture decision records

Short MADR format: context, decision, consequences. One file per decision, numbered, never edited
after acceptance except to change the status (superseded by a newer ADR).

| ADR | Title | Status |
|---|---|---|
| [0001](0001-agent-harness.md) | AGENTS.md is the single source of truth for agents | accepted |
| [0002](0002-stack.md) | Stack: TypeScript, esbuild, plain DOM, Bun as package manager, Node as runtime | accepted (rewritten 2026-10-14, re-acceptance pending) |
| [0003](0003-orchestrator-in-side-panel.md) | The queue runs in the side panel | accepted |
| [0004](0004-carrier-adapter-contract.md) | Carrier adapter contract with dom, http and api strategies | accepted |
| [0005](0005-licensing.md) | Apache-2.0 plus trademark policy | accepted |
| [0006](0006-tooling.md) | Tooling: Biome, Node test runner, zod, own scripts instead of frameworks | accepted (rewritten 2026-10-14, re-acceptance pending) |
| [0007](0007-supply-chain-hardening.md) | Supply-chain hardening for Bun | accepted |
| [0008](0008-pdf-merge-library.md) | PDF merge library | proposed (deferred until batch input) |
| [0009](0009-xlsx-parsing-library.md) | XLSX parsing library | proposed (deferred until batch input) |

Template:

```markdown
# ADR-NNNN: <title>

- Status: proposed | accepted | superseded by ADR-MMMM
- Date: YYYY-MM-DD

## Context
## Decision
## Consequences
```
