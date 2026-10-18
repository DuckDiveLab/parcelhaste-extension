---
id: "004"
title: Queue runner and error handling
status: implemented
---

# Queue runner and error handling

Approved by the maintainer on 2026-10-17 ("approve 004"); implemented the same day.

## Context

Spec 002 turns a pasted row into a `Shipment`. Something must drive it through the carrier
adapter, keep the packer informed, handle failures, and make sure a label is never created twice.
That is the queue runner. It runs in the side panel page (ADR-0003); the background worker is not
involved. Today a run holds one job (one pasted row); spec 008 will queue many, so the runner is
written for a list from the start.

Spec 003 (the Cyprus Post adapter) is blocked on portal captures. The runner is tested with fake
adapters from the contract fixtures, and the stub adapter's `not_implemented` error is what the
panel shows until 003 lands. Saving the label file is spec 005; the runner hands the label to a
`LabelSink` interface that 005 implements.

## Scope

In: the runner in `src/core/queue.ts` (pure logic, injected adapter, sink, clock and id source),
job stages and transitions, automatic retries, cancel, pause and resume, manual retry and skip,
duplicate protection, the panel view model and wiring, restoring an interrupted run. Out: the
carrier adapter itself (003), saving files (005), batch input (008).

## Model

- `Job`: `id`, `shipment`, `stage`, `attempts`, optional `shipmentNumber`, `trackingNumber`,
  `labelFile`, `error`, `allowDuplicate`.
- `JobStage`: `queued` → `filling` → `submitting` → `capturing` → `downloading` → `done`, or
  `failed`, `skipped`, `interrupted` (the panel was closed mid-flight; see AC-004-14).
- `Run`: `id`, `carrierId`, `status` (`idle`, `running`, `paused`, `finished`), `createdAt`,
  `jobs`.
- `LabelSink`: `save(job, label) → Promise<{ file: string }>`. Spec 005 implements it with
  `chrome.downloads`; spec 004 ships an in-memory sink for the panel.
- `CarrierContext` (spec 001) gains optional `onStage(stage)` so adapters report `submitting` and
  `capturing`; the runner sets `filling` before the call and `downloading` after it.
- Retry schedule: at most 2 automatic retries, delays 2 s and 5 s (open question).
- Session history: the order ids completed in this panel session, kept by the panel and passed to
  the runner for duplicate protection.

## Acceptance criteria (EARS)

- **AC-004-1** When a run starts, the runner shall process its jobs one at a time in order,
  moving each from `queued` through `filling` and `downloading` to `done`, and report every
  change through the change callback.
- **AC-004-2** While a job runs, the adapter shall receive a context whose `onStage` moves the job
  to `submitting` or `capturing` as the adapter reports it, and whose `signal` aborts on cancel.
- **AC-004-3** When `createLabel()` resolves, the runner shall store the shipment number and the
  tracking number on the job, hand the label to the sink, store the returned file name and mark
  the job `done`.
- **AC-004-4** If `createLabel()` rejects with a retryable `CarrierError`, then the runner shall
  wait the scheduled delay and try again, at most the configured number of times, counting every
  attempt on the job.
- **AC-004-5** If `createLabel()` rejects with a non-retryable `CarrierError`, or the retries are
  exhausted, then the runner shall mark the job `failed` with the error code and message and
  continue with the next job.
- **AC-004-6** If `createLabel()` rejects with anything that is not a `CarrierError`, then the
  runner shall mark the job `failed` with code `adapter_bug` and shall not retry.
- **AC-004-7** When `cancel()` is called, the runner shall abort the current job's signal, mark
  that job `failed` with code `cancelled` unless it had already resolved, mark the remaining
  queued jobs `skipped`, and finish the run.
- **AC-004-8** When `pause()` is called, the runner shall let the current job finish, set the run
  to `paused` and not start the next job until `resume()` is called.
- **AC-004-9** When `retry(jobId)` is called on a failed job, the runner shall reset its attempts
  and run it again regardless of the error's retryable flag.
- **AC-004-10** When `skip(jobId)` is called on a queued or failed job, the runner shall mark it
  `skipped`.
- **AC-004-11** If a job's order id is already `done` in the same run or in the session history,
  then the runner shall not call the adapter and shall mark the job `failed` with code
  `duplicate_order`, unless the job carries `allowDuplicate`.
- **AC-004-12** If the sink rejects, then the runner shall mark the job `failed` with code
  `label_not_saved` and keep the shipment and tracking numbers, because the label exists at the
  carrier.
- **AC-004-13** The runner shall never run two jobs at the same time and shall call
  `createLabel()` exactly once per attempt.
- **AC-004-14** When the panel restores a run whose current job is in `filling`, `submitting`,
  `capturing` or `downloading`, the panel shall mark that job `interrupted`, show that the portal
  must be checked before retrying, and shall never resume a submit on its own.
- **AC-004-15** The panel view model shall expose, per job, the stage, the attempt count, the
  error message if any, and which actions apply: retry and skip for a failed or interrupted job,
  cancel while running, next when the run is finished.
- **AC-004-16** When the run is finished and the packer chooses next, the panel shall clear the
  paste and the run while keeping the session history of completed order ids.

The panel persists the run to `chrome.storage.session` on every change and restores it when it
opens (AC-004-14). It never persists the pasted text.

## Open questions

- Retry schedule: 2 retries at 2 s and 5 s is a guess. Which portal errors are transient will
  only be known with spec 003.
- Should a failed job stop a batch, or should the batch continue and collect exceptions? This
  spec continues; spec 008 may add a stop-on-failure switch.
- Should the duplicate check also block at paste time (spec 002), with a visible "already created
  today" warning? This spec blocks at run time only.

## Test plan

- `src/core/queue.test.ts`: AC-004-1 to AC-004-13 with fake adapters and sinks, a fake clock for
  the delays, and the shipments from `fixtures/shipments/`.
- `src/inputs/run-view.test.ts` or `entrypoints/sidepanel/run-view.test.ts` (pure view model):
  AC-004-14 to AC-004-16.
