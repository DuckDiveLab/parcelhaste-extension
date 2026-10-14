@AGENTS.md

Claude Code only (everything else is in AGENTS.md):

- `.claude/settings.json` hooks format edited files with Biome and run `bun install` in cloud sessions.
- `.claude/skills/` is generated from `.agents/skills/`: edit the source, then `bun run harness:sync`.
