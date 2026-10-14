---
name: add-carrier
description: Scaffold src/carriers/<id> for a new carrier from the Cyprus Post template: adapter stub, contract test wiring, fixture README and a draft spec.
---

# Add a carrier

1. Pick the id: a lowercase slug such as `royal-mail`. Check `src/carriers/` for an existing one.
2. Copy the structure of `src/carriers/cyprus-post/` into `src/carriers/<id>/`:
   - `adapter.ts`: `info` (id, name, strategy, portalMatches, senderCountryCodes), `supports()`,
     and `createLabel()` that throws `CarrierError("not_implemented", ...)`.
   - `adapter.test.ts`: `runCarrierContract(adapter, { shipments })` with shipments from
     `fixtures/shipments/`.
   - `README.md`: the fixtures the maintainer must provide before the adapter can be specified.
     Adapt the table from the Cyprus Post README.
3. Register the adapter in `src/carriers/index.ts`.
4. Write the draft spec with `.agents/skills/spec/SKILL.md`: `carrier: <id>`, strategy, services,
   customs forms, label format, portal URL patterns, login detection.
5. `bun run check` must be green with the stub alone.
6. Open the PR with `Spec: NNN` and the fixture checklist. The implementation waits for the
   approved spec and the sanitized fixtures.

Rules for the directory: `src/carriers/AGENTS.md`.
