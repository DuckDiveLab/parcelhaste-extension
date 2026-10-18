# The runner takes the adapter by shape, not by import

Spec: 004 · PR: #9

## Problem

The runner lives in `src/core`, which may import only itself, but it drives a `CarrierAdapter`
from `src/carriers/_contract` and must tell a `CarrierError` from any other rejection.

## What worked

- `src/core/queue.ts` declares the slice it needs (`LabelCreator`, `LabelOutput`, `LabelContext`)
  and `CarrierAdapter` satisfies it structurally; the panel passes the adapter straight in.
- The `CarrierError` check is structural too: `name === "CarrierError"` plus a string `code` and a
  boolean `retryable`. The contract's class sets that name, and the runner tests use the real
  class, so the two cannot drift silently.
- The contract imports `AdapterStage` from core for `onStage`, so the stage names have one home.
- A fake adapter that counts calls and a `sleep` injected from the test made retries, cancel and
  pause deterministic without timers.
- A headless Chromium run of `dist/chrome-mv3/sidepanel/main.js` with a stubbed `chrome` object
  (`runtime.getManifest`, `storage.session`) caught nothing this time but proved the wiring:
  paste, Create, Retry, Next, restore of an interrupted job and the duplicate check.

## What failed

- `assert.deepEqual(actual, expected)` narrows `actual` to the type of `expected` (it is an
  assertion signature). A property read after it that is absent from `expected` fails to compile.
  Read the property first, or build `expected` with the full shape.
- With `exactOptionalPropertyTypes`, clearing an optional field by assigning `undefined` is an
  error: `delete job.error`, or declare the field as `T | undefined`.

## Gotchas

- `chrome.storage.session` serialises on `set`; the run holds no `Uint8Array` (the label bytes stay
  in the sink), so it round-trips. Keep it that way when spec 005 adds files.
- A restored run never resumes on its own: `restoreRun()` turns the in-flight job into
  `interrupted`, and the loop only picks up `queued` jobs.

## Tags

`module:core` `module:outputs` `tooling:harness`
