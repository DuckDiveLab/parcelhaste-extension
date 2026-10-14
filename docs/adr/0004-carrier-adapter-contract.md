# ADR-0004: Carrier adapter contract with dom, http and api strategies

- Status: accepted
- Date: 2026-10-14

## Context

Carriers will be added by the community. Without a fixed contract every adapter would expose a
different surface and the queue would need carrier-specific code.

## Decision

- Every carrier implements `CarrierAdapter` (`src/carriers/_contract/adapter.ts`): `info`,
  `supports(shipment)` and `createLabel(shipment, context)` returning a `LabelResult`.
- Adapters reject only with `CarrierError` carrying a `CarrierErrorCode` and a `retryable` flag.
- Strategies evolve `dom` (fill the portal page) → `http` (replay the portal's own requests with
  the user's session) → `api` (official API where one exists). The strategy is declared in `info`.
- A shared contract suite (`runCarrierContract` in `src/carriers/_contract/testing.ts`) runs
  against every adapter with synthetic fixtures. A carrier is not merged until it passes.
- Carriers never import each other; `src/carriers/index.ts` is the registry.

## Consequences

- The queue (spec 004) depends only on the contract.
- Changing the contract is a spec-level change that runs every carrier's tests.
- Fixtures per carrier are sanitized portal captures, listed in each carrier's README.
