---
name: compound
description: After a change, record what was learned as a docs/solutions entry and propose AGENTS.md or CONTEXT.md diffs; promote repeated gotchas into rules.
---

# Compound: keep the lessons

After the PR is up (or merged):

1. Write `docs/solutions/YYYY-MM-DD-slug.md`:

   ```markdown
   # <title>
   Spec: NNN · PR: #n
   ## Problem
   ## What worked
   ## What failed
   ## Gotchas
   ## Tags
   `module:core` `module:inputs` `carrier:cyprus-post` `tooling:build`
   ```

   Keep it short and concrete. Skip the entry if nothing was learned.
2. Propose diffs, and apply them only with the maintainer's agreement:
   - AGENTS.md: a new rule only if it is process the tools cannot see, and only within the
     120-line cap;
   - CONTEXT.md: a term that was missing or wrong.
3. Promotion rule: when the same gotcha appears in two or three solutions, move it into AGENTS.md
   as one rule and delete those episodes. AGENTS.md grows by replacing, not by appending.
4. Never put vocabulary in AGENTS.md, process in CONTEXT.md, or a decision anywhere but `docs/adr/`.
