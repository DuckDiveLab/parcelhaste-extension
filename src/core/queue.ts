// The queue runner (spec 004): drives jobs through a carrier adapter one at a time, retries
// transient errors, and handles cancel, pause, resume, manual retry and skip. Pure logic with
// an injected adapter, label sink and sleep; it runs in the side panel page (ADR-0003).
import type { Shipment } from "./shipment.ts";

export type JobStage =
  | "queued"
  | "filling"
  | "submitting"
  | "capturing"
  | "downloading"
  | "done"
  | "failed"
  | "skipped"
  | "interrupted";

/** The stages an adapter reports through `onStage` while `createLabel()` runs. */
export type AdapterStage = "submitting" | "capturing";

/** Error codes the runner adds to the carrier's own codes. */
export type RunnerErrorCode = "adapter_bug" | "cancelled" | "duplicate_order" | "label_not_saved";

export interface JobError {
  code: string;
  message: string;
  retryable: boolean;
}

/** One shipment moving through a carrier adapter. */
export interface Job {
  id: string;
  shipment: Shipment;
  stage: JobStage;
  attempts: number;
  shipmentNumber?: string;
  trackingNumber?: string;
  /** Path under the Downloads folder once the label is saved. */
  labelFile?: string;
  error?: JobError;
  /** Create the label even if the order id is already in the session history. */
  allowDuplicate?: boolean;
}

export type RunStatus = "idle" | "running" | "paused" | "finished";

/** One execution of a batch of jobs against one carrier. */
export interface Run {
  id: string;
  carrierId: string;
  status: RunStatus;
  createdAt: string;
  jobs: Job[];
}

export interface LabelFile {
  bytes: Uint8Array;
  mimeType: string;
}

/** What the adapter returns; `LabelResult` from the carrier contract satisfies it. */
export interface LabelOutput {
  shipmentNumber: string;
  trackingNumber?: string;
  label: LabelFile;
}

export interface LabelContext {
  /** Aborted on cancel. The adapter stops at its next safe point. */
  signal: AbortSignal;
  onStage: (stage: AdapterStage) => void;
}

/** The slice of a carrier adapter the runner needs. `CarrierAdapter` satisfies it structurally. */
export interface LabelCreator {
  createLabel(shipment: Shipment, context: LabelContext): Promise<LabelOutput>;
}

/** Where the label goes once the carrier produced it. Spec 005 saves it under Downloads. */
export interface LabelSink {
  save(job: Job, label: LabelFile): Promise<{ file: string }>;
}

export interface RetryPolicy {
  /** One delay per automatic retry; its length is the retry limit. */
  delaysMs: readonly number[];
}

export const DEFAULT_RETRY: RetryPolicy = { delaysMs: [2000, 5000] };

export interface RunnerOptions {
  adapter: LabelCreator;
  sink: LabelSink;
  /** Called after every change of the run. The run object is the runner's own; read it only. */
  onChange: (run: Run) => void;
  /** Order ids completed earlier in this panel session (duplicate protection). */
  history?: ReadonlySet<string>;
  retry?: RetryPolicy;
  /** Resolves after `ms`, or at once when the signal aborts. Injected by tests. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

export interface Runner {
  readonly run: Run;
  /** Runs the queued jobs; resolves when the run is finished or paused. */
  start(): Promise<void>;
  cancel(): void;
  pause(): void;
  resume(): Promise<void>;
  /** Runs a failed or interrupted job again, from attempt one, whatever its error was. */
  retry(jobId: string): Promise<void>;
  skip(jobId: string): void;
}

export const IN_FLIGHT_STAGES: ReadonlySet<JobStage> = new Set([
  "filling",
  "submitting",
  "capturing",
  "downloading",
]);

const RETRIABLE_STAGES: ReadonlySet<JobStage> = new Set(["failed", "interrupted"]);
const SKIPPABLE_STAGES: ReadonlySet<JobStage> = new Set(["queued", "failed", "interrupted"]);

export function createRun(
  carrierId: string,
  shipments: readonly Shipment[],
  options: { now?: () => Date; newId?: () => string } = {},
): Run {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const createdAt = (options.now ?? (() => new Date()))().toISOString();
  return {
    id: newId(),
    carrierId,
    status: "idle",
    createdAt,
    jobs: shipments.map((shipment) => ({ id: newId(), shipment, stage: "queued", attempts: 0 })),
  };
}

/** Prepares a persisted run for the panel: a job caught mid-flight becomes `interrupted`. */
export function restoreRun(stored: Run): Run {
  const jobs = stored.jobs.map((job) =>
    IN_FLIGHT_STAGES.has(job.stage) ? { ...job, stage: "interrupted" as const } : job,
  );
  const status: RunStatus = jobs.some((job) => job.stage === "queued") ? "paused" : "finished";
  return { ...stored, status, jobs };
}

/** Order ids whose label was created in this run. */
export function completedOrderIds(run: Run): string[] {
  return run.jobs.filter((job) => job.stage === "done").map((job) => job.shipment.orderId);
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

/** Structural check for the contract's CarrierError: src/core does not import src/carriers. */
function isCarrierError(error: unknown): error is Error & { code: string; retryable: boolean } {
  return (
    error instanceof Error &&
    error.name === "CarrierError" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { retryable?: unknown }).retryable === "boolean"
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toJobError(error: unknown): JobError {
  if (isCarrierError(error)) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  return { code: "adapter_bug", message: messageOf(error), retryable: false };
}

export function createRunner(run: Run, options: RunnerOptions): Runner {
  const { adapter, sink, onChange } = options;
  const history = options.history ?? new Set<string>();
  const delays = (options.retry ?? DEFAULT_RETRY).delaysMs;
  const sleep = options.sleep ?? defaultSleep;

  let loop: Promise<void> | undefined;
  let current: { job: Job; controller: AbortController } | undefined;
  let cancelled = false;
  let pauseRequested = false;

  const emit = (): void => {
    onChange(run);
  };

  const setStage = (job: Job, stage: JobStage): void => {
    job.stage = stage;
    emit();
  };

  const fail = (job: Job, error: JobError): void => {
    job.error = error;
    setStage(job, "failed");
  };

  const isDuplicate = (job: Job): boolean =>
    history.has(job.shipment.orderId) ||
    run.jobs.some(
      (other) =>
        other !== job && other.stage === "done" && other.shipment.orderId === job.shipment.orderId,
    );

  const skipQueued = (): void => {
    for (const job of run.jobs) {
      if (job.stage === "queued") {
        job.stage = "skipped";
      }
    }
  };

  const runJob = async (job: Job): Promise<void> => {
    if (job.allowDuplicate !== true && isDuplicate(job)) {
      fail(job, {
        code: "duplicate_order",
        message: `A label for order ${job.shipment.orderId} was already created in this session.`,
        retryable: false,
      });
      return;
    }
    const controller = new AbortController();
    current = { job, controller };
    const context: LabelContext = {
      signal: controller.signal,
      onStage: (stage) => {
        if (IN_FLIGHT_STAGES.has(job.stage)) {
          setStage(job, stage);
        }
      },
    };
    try {
      while (true) {
        job.attempts += 1;
        setStage(job, "filling");
        let output: LabelOutput;
        try {
          output = await adapter.createLabel(job.shipment, context);
        } catch (error) {
          if (cancelled) {
            fail(job, { code: "cancelled", message: "Stopped by the packer.", retryable: false });
            return;
          }
          const jobError = toJobError(error);
          const delay = delays[job.attempts - 1];
          if (!jobError.retryable || delay === undefined) {
            fail(job, jobError);
            return;
          }
          await sleep(delay, controller.signal);
          if (cancelled) {
            fail(job, { code: "cancelled", message: "Stopped by the packer.", retryable: false });
            return;
          }
          continue;
        }
        job.shipmentNumber = output.shipmentNumber;
        if (output.trackingNumber !== undefined) {
          job.trackingNumber = output.trackingNumber;
        }
        setStage(job, "downloading");
        try {
          const { file } = await sink.save(job, output.label);
          job.labelFile = file;
          setStage(job, "done");
        } catch (error) {
          fail(job, { code: "label_not_saved", message: messageOf(error), retryable: false });
        }
        return;
      }
    } finally {
      current = undefined;
    }
  };

  const drive = async (): Promise<void> => {
    run.status = "running";
    emit();
    while (true) {
      if (cancelled) {
        break;
      }
      if (pauseRequested) {
        pauseRequested = false;
        run.status = "paused";
        emit();
        return;
      }
      const next = run.jobs.find((job) => job.stage === "queued");
      if (next === undefined) {
        break;
      }
      await runJob(next);
    }
    skipQueued();
    run.status = "finished";
    emit();
  };

  const ensureRunning = (): Promise<void> => {
    if (loop === undefined) {
      loop = drive().finally(() => {
        loop = undefined;
      });
    }
    return loop;
  };

  const find = (jobId: string): Job | undefined => run.jobs.find((job) => job.id === jobId);

  return {
    run,
    start: ensureRunning,
    resume: ensureRunning,
    cancel() {
      cancelled = true;
      pauseRequested = false;
      current?.controller.abort();
      if (loop === undefined) {
        skipQueued();
        run.status = "finished";
        emit();
      }
    },
    pause() {
      if (run.status === "running") {
        pauseRequested = true;
      }
    },
    retry(jobId) {
      const job = find(jobId);
      if (job === undefined || !RETRIABLE_STAGES.has(job.stage)) {
        return Promise.resolve();
      }
      job.attempts = 0;
      delete job.error;
      delete job.shipmentNumber;
      delete job.trackingNumber;
      delete job.labelFile;
      cancelled = false;
      setStage(job, "queued");
      return run.status === "paused" ? Promise.resolve() : ensureRunning();
    },
    skip(jobId) {
      const job = find(jobId);
      if (job !== undefined && SKIPPABLE_STAGES.has(job.stage)) {
        delete job.error;
        setStage(job, "skipped");
      }
    },
  };
}
