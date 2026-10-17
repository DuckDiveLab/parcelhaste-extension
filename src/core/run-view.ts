// What the side panel shows while a run executes (spec 004, AC-004-14 to 16). Pure: no DOM.
import { completedOrderIds, type JobStage, type Run, type RunStatus } from "./queue.ts";

export type JobAction = "retry" | "skip";

export interface JobView {
  id: string;
  orderId: string;
  recipientName: string;
  stage: JobStage;
  attempts: number;
  trackingNumber?: string;
  error?: string;
  /** Shown instead of an error for a job that needs a human look first. */
  note?: string;
  actions: JobAction[];
}

export interface RunViewModel {
  status: RunStatus;
  jobs: JobView[];
  canCancel: boolean;
  canPause: boolean;
  canResume: boolean;
  canNext: boolean;
}

export const INTERRUPTED_NOTE =
  "The panel closed while this job was at the portal. Check the portal for a created label before retrying.";

function actionsFor(stage: JobStage): JobAction[] {
  switch (stage) {
    case "failed":
    case "interrupted":
      return ["retry", "skip"];
    case "queued":
      return ["skip"];
    default:
      return [];
  }
}

export function runViewModel(run: Run): RunViewModel {
  return {
    status: run.status,
    jobs: run.jobs.map((job) => {
      const view: JobView = {
        id: job.id,
        orderId: job.shipment.orderId,
        recipientName: job.shipment.recipient.name,
        stage: job.stage,
        attempts: job.attempts,
        actions: actionsFor(job.stage),
      };
      if (job.trackingNumber !== undefined) {
        view.trackingNumber = job.trackingNumber;
      }
      if (job.error !== undefined) {
        view.error = `${job.error.code}: ${job.error.message}`;
      }
      if (job.stage === "interrupted") {
        view.note = INTERRUPTED_NOTE;
      }
      return view;
    }),
    canCancel: run.status === "running" || run.status === "paused",
    canPause: run.status === "running",
    canResume: run.status === "paused",
    canNext: run.status === "finished",
  };
}

/** The panel's state between pastes. The run is persisted; the paste never is. */
export interface PanelState {
  paste: string;
  run?: Run | undefined;
  history: readonly string[];
}

/** "Next": clears the paste and the run, remembering the order ids whose label was created. */
export function nextState(state: PanelState): PanelState {
  const completed = state.run === undefined ? [] : completedOrderIds(state.run);
  return { paste: "", history: [...state.history, ...completed] };
}
