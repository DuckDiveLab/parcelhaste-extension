import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CarrierError } from "../carriers/_contract/adapter.ts";
import {
  createRun,
  createRunner,
  type LabelContext,
  type LabelCreator,
  type LabelOutput,
  type LabelSink,
  type Run,
  type RunnerOptions,
} from "./queue.ts";
import { type Shipment, ShipmentSchema } from "./shipment.ts";

const fixturesDir = path.resolve(import.meta.dirname, "../../fixtures/shipments");
const base = ShipmentSchema.parse(
  JSON.parse(readFileSync(path.join(fixturesDir, "eu-single-item.json"), "utf8")),
);

function shipment(orderId: string): Shipment {
  return { ...base, orderId };
}

function label(orderId: string): LabelOutput {
  return {
    shipmentNumber: `SN-${orderId}`,
    trackingNumber: `RR${orderId}CY`,
    label: { bytes: new Uint8Array([37, 80, 68, 70]), mimeType: "application/pdf" },
  };
}

type Handler = (shipment: Shipment, context: LabelContext, call: number) => Promise<LabelOutput>;

/** An adapter that counts its calls and delegates to the handler. */
function adapterFrom(handler: Handler): LabelCreator & { calls: number } {
  const adapter = {
    calls: 0,
    createLabel(target: Shipment, context: LabelContext): Promise<LabelOutput> {
      adapter.calls += 1;
      return handler(target, context, adapter.calls);
    },
  };
  return adapter;
}

const okAdapter = (): LabelCreator & { calls: number } =>
  adapterFrom(async (target) => label(target.orderId));

const okSink: LabelSink = {
  async save(job) {
    return { file: `${job.shipment.orderId}.pdf` };
  },
};

/** Records every change as "<run status> <job stages>". */
function recorder(): { snapshots: string[]; onChange: (run: Run) => void } {
  const snapshots: string[] = [];
  return {
    snapshots,
    onChange: (run) => {
      snapshots.push(`${run.status} ${run.jobs.map((job) => job.stage).join(",")}`);
    },
  };
}

function options(overrides: Partial<RunnerOptions> = {}): RunnerOptions {
  return {
    adapter: okAdapter(),
    sink: okSink,
    onChange: () => {},
    sleep: async () => {},
    ...overrides,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Lets queued microtasks run so the runner reaches its next await. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

test("AC-004-1 runs the jobs one at a time in order and reports every change", async () => {
  const run = createRun("fake", [shipment("A"), shipment("B")]);
  const { snapshots, onChange } = recorder();
  const runner = createRunner(run, options({ onChange }));
  await runner.start();
  assert.deepEqual(snapshots, [
    "running queued,queued",
    "running filling,queued",
    "running downloading,queued",
    "running done,queued",
    "running done,filling",
    "running done,downloading",
    "running done,done",
    "finished done,done",
  ]);
});

test("AC-004-2 the adapter context reports submitting and capturing and aborts on cancel", async () => {
  const run = createRun("fake", [shipment("A")]);
  const gate = deferred<void>();
  let aborted = false;
  const adapter = adapterFrom(async (_target, context) => {
    context.onStage("submitting");
    context.onStage("capturing");
    await gate.promise;
    aborted = context.signal.aborted;
    throw new CarrierError("cancelled", "stopped by the user");
  });
  const { snapshots, onChange } = recorder();
  const runner = createRunner(run, options({ adapter, onChange }));
  const finished = runner.start();
  await tick();
  runner.cancel();
  gate.resolve();
  await finished;
  assert.equal(aborted, true);
  assert.deepEqual(snapshots.slice(0, 4), [
    "running queued",
    "running filling",
    "running submitting",
    "running capturing",
  ]);
});

test("AC-004-3 stores the numbers, hands the label to the sink and marks the job done", async () => {
  const run = createRun("fake", [shipment("A")]);
  const saved: { jobId: string; mimeType: string; bytes: number }[] = [];
  const sink: LabelSink = {
    async save(job, file) {
      saved.push({ jobId: job.id, mimeType: file.mimeType, bytes: file.bytes.length });
      return { file: "labels/A.pdf" };
    },
  };
  await createRunner(run, options({ sink })).start();
  const job = run.jobs[0];
  assert.equal(job?.stage, "done");
  assert.equal(job?.shipmentNumber, "SN-A");
  assert.equal(job?.trackingNumber, "RRACY");
  assert.equal(job?.labelFile, "labels/A.pdf");
  assert.deepEqual(saved, [{ jobId: job?.id, mimeType: "application/pdf", bytes: 4 }]);
});

test("AC-004-4 retries a retryable error after the scheduled delays, counting every attempt", async () => {
  const run = createRun("fake", [shipment("A")]);
  const delays: number[] = [];
  const adapter = adapterFrom(async (target, _context, call) => {
    if (call < 3) {
      throw new CarrierError("network", `attempt ${call} timed out`, { retryable: true });
    }
    return label(target.orderId);
  });
  await createRunner(
    run,
    options({
      adapter,
      sleep: async (ms) => {
        delays.push(ms);
      },
    }),
  ).start();
  assert.equal(adapter.calls, 3);
  assert.equal(run.jobs[0]?.attempts, 3);
  assert.equal(run.jobs[0]?.stage, "done");
  assert.deepEqual(delays, [2000, 5000]);
});

test("AC-004-5 marks the job failed after the retries are exhausted and continues", async () => {
  const run = createRun("fake", [shipment("A"), shipment("B")]);
  const adapter = adapterFrom(async (target) => {
    if (target.orderId === "A") {
      throw new CarrierError("network", "portal unreachable", { retryable: true });
    }
    return label(target.orderId);
  });
  await createRunner(run, options({ adapter })).start();
  assert.equal(run.jobs[0]?.stage, "failed");
  assert.equal(run.jobs[0]?.attempts, 3);
  assert.deepEqual(run.jobs[0]?.error, {
    code: "network",
    message: "portal unreachable",
    retryable: true,
  });
  assert.equal(run.jobs[1]?.stage, "done");
  assert.equal(run.status, "finished");
});

test("AC-004-5 marks the job failed at once on a non-retryable error and continues", async () => {
  const run = createRun("fake", [shipment("A"), shipment("B")]);
  const adapter = adapterFrom(async (target) => {
    if (target.orderId === "A") {
      throw new CarrierError("portal_rejected", "postcode refused");
    }
    return label(target.orderId);
  });
  await createRunner(run, options({ adapter })).start();
  assert.equal(adapter.calls, 2);
  assert.equal(run.jobs[0]?.stage, "failed");
  assert.equal(run.jobs[0]?.attempts, 1);
  assert.equal(run.jobs[0]?.error?.code, "portal_rejected");
  assert.equal(run.jobs[0]?.error?.message, "postcode refused");
  assert.equal(run.jobs[1]?.stage, "done");
});

test("AC-004-6 reports anything that is not a CarrierError as adapter_bug without retrying", async () => {
  const run = createRun("fake", [shipment("A")]);
  const adapter = adapterFrom(async () => {
    throw new TypeError("Cannot read properties of undefined");
  });
  await createRunner(run, options({ adapter })).start();
  assert.equal(adapter.calls, 1);
  assert.equal(run.jobs[0]?.stage, "failed");
  assert.deepEqual(run.jobs[0]?.error, {
    code: "adapter_bug",
    message: "Cannot read properties of undefined",
    retryable: false,
  });
});

test("AC-004-7 cancel fails the current job as cancelled, skips the rest and finishes", async () => {
  const run = createRun("fake", [shipment("A"), shipment("B"), shipment("C")]);
  const adapter = adapterFrom(
    (_target, context) =>
      new Promise((_resolve, reject) => {
        context.signal.addEventListener("abort", () => {
          reject(new CarrierError("cancelled", "stopped"));
        });
      }),
  );
  const runner = createRunner(run, options({ adapter }));
  const finished = runner.start();
  await tick();
  runner.cancel();
  await finished;
  assert.equal(adapter.calls, 1);
  assert.deepEqual(
    run.jobs.map((job) => job.stage),
    ["failed", "skipped", "skipped"],
  );
  assert.equal(run.jobs[0]?.error?.code, "cancelled");
  assert.equal(run.status, "finished");
});

test("AC-004-7 cancel keeps a job that had already resolved", async () => {
  const run = createRun("fake", [shipment("A"), shipment("B")]);
  const gate = deferred<void>();
  const adapter = adapterFrom(async (target) => {
    await gate.promise;
    return label(target.orderId);
  });
  const runner = createRunner(run, options({ adapter }));
  const finished = runner.start();
  await tick();
  runner.cancel();
  gate.resolve();
  await finished;
  assert.deepEqual(
    run.jobs.map((job) => job.stage),
    ["done", "skipped"],
  );
  assert.equal(run.jobs[0]?.trackingNumber, "RRACY");
});

test("AC-004-7 cancel while waiting for a retry fails the job as cancelled", async () => {
  const run = createRun("fake", [shipment("A")]);
  const adapter = adapterFrom(async () => {
    throw new CarrierError("network", "timeout", { retryable: true });
  });
  const sleeping = deferred<void>();
  const runner = createRunner(
    run,
    options({
      adapter,
      sleep: (_ms, signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve());
          sleeping.resolve();
        }),
    }),
  );
  const finished = runner.start();
  await sleeping.promise;
  runner.cancel();
  await finished;
  assert.equal(adapter.calls, 1);
  assert.equal(run.jobs[0]?.stage, "failed");
  assert.equal(run.jobs[0]?.error?.code, "cancelled");
});

test("AC-004-8 pause lets the current job finish and resume starts the next one", async () => {
  const run = createRun("fake", [shipment("A"), shipment("B")]);
  const gate = deferred<void>();
  const adapter = adapterFrom(async (target) => {
    if (target.orderId === "A") {
      await gate.promise;
    }
    return label(target.orderId);
  });
  const runner = createRunner(run, options({ adapter }));
  const paused = runner.start();
  await tick();
  runner.pause();
  gate.resolve();
  await paused;
  assert.equal(run.status, "paused");
  assert.deepEqual(
    run.jobs.map((job) => job.stage),
    ["done", "queued"],
  );
  assert.equal(adapter.calls, 1);
  await runner.resume();
  assert.equal(run.status, "finished");
  assert.deepEqual(
    run.jobs.map((job) => job.stage),
    ["done", "done"],
  );
});

test("AC-004-9 retry resets the attempts and runs a failed job again whatever its retryable flag", async () => {
  const run = createRun("fake", [shipment("A")]);
  const adapter = adapterFrom(async (target, _context, call) => {
    if (call === 1) {
      throw new CarrierError("portal_rejected", "refused", { retryable: false });
    }
    return label(target.orderId);
  });
  const runner = createRunner(run, options({ adapter }));
  await runner.start();
  const job = run.jobs[0];
  assert.equal(job?.stage, "failed");
  assert.equal(job?.attempts, 1);
  await runner.retry(job?.id ?? "");
  assert.equal(adapter.calls, 2);
  assert.equal(job?.attempts, 1);
  assert.equal(job?.stage, "done");
  assert.equal(job?.error, undefined);
  assert.equal(run.status, "finished");
});

test("AC-004-10 skip marks a queued or failed job skipped", async () => {
  const run = createRun("fake", [shipment("A"), shipment("B")]);
  const adapter = adapterFrom(async () => {
    throw new CarrierError("portal_rejected", "refused");
  });
  const gate = deferred<void>();
  const runner = createRunner(
    run,
    options({
      adapter: adapterFrom(async (target) => {
        await gate.promise;
        throw new CarrierError("portal_rejected", `refused ${target.orderId}`);
      }),
    }),
  );
  const paused = runner.start();
  await tick();
  runner.pause();
  gate.resolve();
  await paused;
  const [first, second] = run.jobs;
  assert.equal(first?.stage, "failed");
  assert.equal(second?.stage, "queued");
  runner.skip(first?.id ?? "");
  runner.skip(second?.id ?? "");
  assert.deepEqual(
    run.jobs.map((job) => job.stage),
    ["skipped", "skipped"],
  );
  assert.equal(adapter.calls, 0);
});

test("AC-004-11 refuses an order id already done in the session history or in the run", async () => {
  const run = createRun("fake", [shipment("A"), shipment("B"), shipment("B")]);
  const adapter = okAdapter();
  await createRunner(run, options({ adapter, history: new Set(["A"]) })).start();
  assert.equal(adapter.calls, 1);
  assert.deepEqual(
    run.jobs.map((job) => job.stage),
    ["failed", "done", "failed"],
  );
  assert.equal(run.jobs[0]?.error?.code, "duplicate_order");
  assert.equal(run.jobs[2]?.error?.code, "duplicate_order");
  assert.equal(run.jobs[0]?.attempts, 0);
});

test("AC-004-11 allowDuplicate lets a repeated order id through", async () => {
  const run = createRun("fake", [shipment("A")]);
  const job = run.jobs[0];
  if (job !== undefined) {
    job.allowDuplicate = true;
  }
  const adapter = okAdapter();
  await createRunner(run, options({ adapter, history: new Set(["A"]) })).start();
  assert.equal(adapter.calls, 1);
  assert.equal(run.jobs[0]?.stage, "done");
});

test("AC-004-12 a failing sink marks the job label_not_saved and keeps the numbers", async () => {
  const run = createRun("fake", [shipment("A")]);
  const sink: LabelSink = {
    async save() {
      throw new Error("disk full");
    },
  };
  await createRunner(run, options({ sink })).start();
  const job = run.jobs[0];
  assert.equal(job?.stage, "failed");
  assert.deepEqual(job?.error, { code: "label_not_saved", message: "disk full", retryable: false });
  assert.equal(job?.shipmentNumber, "SN-A");
  assert.equal(job?.trackingNumber, "RRACY");
  assert.equal(job?.labelFile, undefined);
});

test("AC-004-13 never runs two jobs at once and calls createLabel once per attempt", async () => {
  const run = createRun("fake", [shipment("A"), shipment("B"), shipment("C")]);
  let inFlight = 0;
  let maxInFlight = 0;
  const adapter = adapterFrom(async (target, _context, call) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await tick();
    inFlight -= 1;
    if (call === 2) {
      throw new CarrierError("network", "blip", { retryable: true });
    }
    return label(target.orderId);
  });
  const runner = createRunner(run, options({ adapter }));
  await Promise.all([runner.start(), runner.start(), runner.resume()]);
  assert.equal(maxInFlight, 1);
  const attempts = run.jobs.reduce((total, job) => total + job.attempts, 0);
  assert.equal(adapter.calls, attempts);
  assert.equal(attempts, 4);
  assert.deepEqual(
    run.jobs.map((job) => job.stage),
    ["done", "done", "done"],
  );
});
