# Carrier rules

Applies to everything under `src/carriers/`. The root AGENTS.md still applies.

- One directory per carrier, `src/carriers/<id>/`, with `adapter.ts`, `adapter.test.ts` and
  `README.md`. `<id>` is a lowercase slug and is also `info.id`, the Downloads subfolder and the
  `carrier:` field of the carrier's specs.
- Implement `CarrierAdapter` from `../_contract/adapter.ts` and register the adapter in
  `src/carriers/index.ts`, the only file that imports every carrier.
- `adapter.test.ts` calls `runCarrierContract(adapter, { shipments })` from
  `../_contract/testing.ts` with shipments from `fixtures/shipments/`. Carrier-specific tests go in
  the same file.
- Strategies: start with `dom` against sanitized HTML fixtures in `fixtures/carriers/<id>/`; move
  to `http` once the portal's requests are recorded (HAR with cookies and tokens removed); `api`
  only against official documentation.
- Reject only with `CarrierError` and a code from `CarrierErrorCode`. Map every portal error you
  have seen to a code; unknown pages are `portal_changed`.
- Never import another carrier. Shared needs go to `src/core` through a spec, not into `_contract`.
- Changing `_contract/` affects every carrier: spec first, and run every carrier's tests.
- Never test against the live portal. Never commit a real session, account number or customer data.
