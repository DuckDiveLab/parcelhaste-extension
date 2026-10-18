import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createRun, createRunner, type Job, type LabelCreator, restoreRun } from "./queue.ts";
import { INTERRUPTED_NOTE, nextState, runViewModel } from "./run-view.ts";
import { type Shipment, ShipmentSchema } from "./shipment.ts";

const fixturesDir = path.resolve(import.meta.dirname, "../../fixtures/shipments");
const base = ShipmentSchema.parse(
  JSON.parse(readFileSync(path.join(fixturesDir, "eu-single-item.json"), "utf8")),
);

function shipment(orderId: string): Shipment {
  return { ...base, orderId };
}

function withStage(job: Job | undefined, stage: Job["stage"], extra: Partial<Job> = {}): void {
  if (job !== undefined) {
    Object.assign(job, { stage, ...extra });
  }
}

test("AC-004-14 restoring a run marks the in-flight job interrupted and never resumes it", async () => {
  for (const stage of ["filling", "submitting", "capturing", "downloading"] as const) {
    const stored = createRun("fake", [shipment("A"), shipment("B")]);
    stored.status = "running";
    withStage(stored.jobs[0], stage, { attempts: 1 });
    const restored = restoreRun(stored);
    assert.equal(restored.jobs[0]?.stage, "interrupted", stage);
    assert.equal(restored.jobs[1]?.stage, "queued");
    assert.equal(restored.status, "paused");

    const view = runViewModel(restored);
    assert.equal(view.jobs[0]?.note, INTERRUPTED_NOTE);
    assert.match(INTERRUPTED_NOTE, /portal/i);
    assert.deepEqual(view.jobs[0]?.actions, ["retry", "skip"]);
  }
  const stored = createRun("fake", [shipment("A")]);
  stored.status = "running";
  withStage(stored.jobs[0], "submitting", { attempts: 1 });
  const restored = restoreRun(stored);
  assert.equal(restored.status, "finished");
  let calls = 0;
  const adapter: LabelCreator = {
    createLabel: () => {
      calls += 1;
      return Promise.reject(new Error("must not run"));
    },
  };
  const runner = createRunner(restored, {
    adapter,
    sink: { save: async () => ({ file: "x" }) },
    onChange: () => {},
  });
  await runner.start();
  assert.equal(calls, 0);
  assert.equal(restored.jobs[0]?.stage, "interrupted");
});

test("AC-004-15 the view model exposes stage, attempts, error and the applicable actions", () => {
  const run = createRun("fake", [shipment("A"), shipment("B"), shipment("C")]);
  run.status = "running";
  withStage(run.jobs[0], "failed", {
    attempts: 3,
    error: { code: "network", message: "portal unreachable", retryable: true },
  });
  withStage(run.jobs[1], "submitting", { attempts: 1 });
  const running = runViewModel(run);
  assert.equal(running.canCancel, true);
  assert.equal(running.canPause, true);
  assert.equal(running.canNext, false);
  assert.deepEqual(running.jobs[0], {
    id: run.jobs[0]?.id,
    orderId: "A",
    recipientName: "Test Recipient",
    stage: "failed",
    attempts: 3,
    error: "network: portal unreachable",
    actions: ["retry", "skip"],
  });
  assert.deepEqual(running.jobs[1]?.actions, []);
  assert.equal(running.jobs[1]?.attempts, 1);
  assert.deepEqual(running.jobs[2]?.actions, ["skip"]);

  run.status = "paused";
  assert.equal(runViewModel(run).canResume, true);

  run.status = "finished";
  withStage(run.jobs[1], "done", { trackingNumber: "RRBCY" });
  withStage(run.jobs[2], "skipped");
  const finished = runViewModel(run);
  assert.equal(finished.canNext, true);
  assert.equal(finished.canCancel, false);
  assert.deepEqual(finished.jobs[1]?.actions, []);
  assert.equal(finished.jobs[1]?.trackingNumber, "RRBCY");
});

test("AC-004-16 next clears the paste and the run and keeps the completed order ids", () => {
  const run = createRun("fake", [shipment("A"), shipment("B")]);
  run.status = "finished";
  withStage(run.jobs[0], "done");
  withStage(run.jobs[1], "failed");
  const next = nextState({ paste: "orderName\tA\t", run, history: ["Z"] });
  assert.equal(next.run, undefined);
  assert.deepEqual(next, { paste: "", history: ["Z", "A"] });
  assert.deepEqual(nextState({ paste: "x", run: undefined, history: ["Z"] }).history, ["Z"]);
});
