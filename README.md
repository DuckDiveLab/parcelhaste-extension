# ParcelHaste

Browser extension that creates shipping labels and customs declarations on carrier web portals
from pasted order rows. Copy one row from your order export, paste it into the side panel, press
Create: the extension fills the portal form, submits it, captures the tracking number and saves the
label PDF. A human only handles exceptions.

**Status: pre-alpha.** The harness, the data model and a Cyprus Post stub exist; no carrier works
yet. First carrier: Cyprus Post (ePost portal). More carriers are welcome from the community.

- Chrome only, Manifest V3. Other browsers are out of scope (ADR-0002).
- Few dependencies on purpose: one at runtime (zod), four for development.
- Labels land under `Downloads/ParcelHaste/<carrier>/<date>/<order-id>_<tracking>.pdf`.

## Develop

```sh
bun install --frozen-lockfile   # Bun 1.4.3 (pinned), Node 24
bun run dev                     # builds dist/chrome-mv3 and watches; load it unpacked
bun run check                   # lint, typecheck, tests, harness-check: the one gate
bun run build                   # Chrome zip in dist/
```

## Contribute, with any agent

Read [AGENTS.md](AGENTS.md) first; it is the single set of instructions for Claude Code, Codex,
Grok Build, Cursor, Copilot and humans. Vocabulary is in [CONTEXT.md](CONTEXT.md), decisions in
[docs/adr](docs/adr/), intent in [docs/specs](docs/specs/). Workflows are skills under
[.agents/skills](.agents/skills/). Details in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0, © 2026 DuckDiveLab Pte. Ltd. "ParcelHaste" is a trademark; see
[TRADEMARKS.md](TRADEMARKS.md).
