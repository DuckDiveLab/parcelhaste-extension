// Queue and run state. Types only; the runner logic arrives with spec 004.
// The queue runs in the side panel page, not the background worker (ADR-0003).
import type { Shipment } from "./shipment.ts";

export type JobStage =
  | "queued"
  | "filling"
  | "submitting"
  | "capturing"
  | "downloading"
  | "done"
  | "failed"
  | "skipped";

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
