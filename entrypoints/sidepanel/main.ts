// Side panel entry point. Plain DOM, no framework (ADR-0002). Thin glue: parsing lives in
// src/inputs, the queue runner in src/core (ADR-0003). The run is persisted to
// chrome.storage.session on every change; the pasted text never is (spec 004).
import { carriers, findCarrier } from "../../src/carriers/index.ts";
import {
  createRun,
  createRunner,
  type Run,
  type Runner,
  restoreRun,
} from "../../src/core/queue.ts";
import { nextState, runViewModel } from "../../src/core/run-view.ts";
import type { Shipment } from "../../src/core/shipment.ts";
import { parseRows } from "../../src/inputs/row.ts";
import { type RowViewModel, rowViewModel } from "../../src/inputs/row-view.ts";
import { createMemorySink } from "../../src/outputs/memory-sink.ts";

const STORAGE_KEYS = { run: "run", history: "history" } as const;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const node = element("button", { type: "button", textContent: text });
  node.addEventListener("click", onClick);
  return node;
}

/** Renders the result of a paste: summary, report and the Create button's state. */
function renderResult(container: HTMLElement, create: HTMLButtonElement, view: RowViewModel): void {
  create.disabled = !view.canCreate;
  const parts: Node[] = [];
  if (view.summary !== undefined) {
    const { recipientName, countryCode, weightGrams, itemCount } = view.summary;
    parts.push(
      element("p", {
        className: "summary",
        textContent: `${recipientName}, ${countryCode}, ${weightGrams} g, ${itemCount} item(s)`,
      }),
    );
  }
  if (view.issues.length > 0) {
    parts.push(
      element(
        "ul",
        { className: "issues" },
        view.issues.map((issue) =>
          element("li", { className: `issue-${issue.level}`, textContent: issue.message }),
        ),
      ),
    );
  }
  container.replaceChildren(...parts);
}

interface RunActions {
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  retry: (jobId: string) => void;
  skip: (jobId: string) => void;
  next: () => void;
}

/** Renders the run: one line per job with its stage, attempts, error and actions. */
function renderRun(container: HTMLElement, run: Run | undefined, actions: RunActions): void {
  if (run === undefined) {
    container.replaceChildren();
    return;
  }
  const view = runViewModel(run);
  const jobs = view.jobs.map((job) => {
    const line = element("li", { className: `job job-${job.stage}` }, [
      element("span", {
        className: "job-head",
        textContent: `${job.orderId} · ${job.recipientName} · ${job.stage} (attempt ${job.attempts})`,
      }),
    ]);
    if (job.trackingNumber !== undefined) {
      line.append(element("span", { className: "muted", textContent: ` ${job.trackingNumber}` }));
    }
    if (job.error !== undefined) {
      line.append(element("p", { className: "issue-error", textContent: job.error }));
    }
    if (job.note !== undefined) {
      line.append(element("p", { className: "issue-warning", textContent: job.note }));
    }
    for (const action of job.actions) {
      const handler = action === "retry" ? actions.retry : actions.skip;
      line.append(button(action === "retry" ? "Retry" : "Skip", () => handler(job.id)));
    }
    return line;
  });
  const controls: Node[] = [];
  if (view.canCancel) {
    controls.push(button("Cancel", actions.cancel));
  }
  if (view.canPause) {
    controls.push(button("Pause", actions.pause));
  }
  if (view.canResume) {
    controls.push(button("Resume", actions.resume));
  }
  if (view.canNext) {
    controls.push(button("Next", actions.next));
  }
  container.replaceChildren(
    element("p", { className: "muted", textContent: `Run ${view.status}` }),
    element("ul", { className: "jobs" }, jobs),
    element("div", { className: "controls" }, controls),
  );
}

function isRun(value: unknown): value is Run {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Run).id === "string" &&
    typeof (value as Run).carrierId === "string" &&
    Array.isArray((value as Run).jobs)
  );
}

function isHistory(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function mount(root: HTMLElement): void {
  const { version } = chrome.runtime.getManifest();
  const carrierSelect = element("select", { id: "carrier" });
  for (const carrier of carriers) {
    carrierSelect.append(
      element("option", { value: carrier.info.id, textContent: carrier.info.name }),
    );
  }
  const rowInput = element("textarea", {
    id: "row",
    placeholder: "Paste the row copied with F11 at the Make label step",
  });
  const create = element("button", { type: "button", textContent: "Create label", disabled: true });
  const result = element("div", { id: "result" });
  const runView = element("div", { id: "run" });
  const status = element("p", { className: "muted" });
  const sink = createMemorySink();

  let history: readonly string[] = [];
  let run: Run | undefined;
  let runner: Runner | undefined;
  let shipment: Shipment | undefined;

  const persist = (): void => {
    void chrome.storage.session.set({
      [STORAGE_KEYS.run]: run,
      [STORAGE_KEYS.history]: history,
    });
  };

  const actions: RunActions = {
    cancel: () => runner?.cancel(),
    pause: () => runner?.pause(),
    resume: () => void runner?.resume(),
    retry: (jobId) => void runner?.retry(jobId),
    skip: (jobId) => runner?.skip(jobId),
    next: () => {
      const next = nextState({ paste: rowInput.value, run, history });
      history = next.history;
      run = undefined;
      runner = undefined;
      rowInput.value = next.paste;
      void chrome.storage.session.remove(STORAGE_KEYS.run);
      persist();
      update();
      renderRun(runView, run, actions);
    },
  };

  const attach = (target: Run): void => {
    const carrier = findCarrier(target.carrierId);
    if (carrier === undefined) {
      status.textContent = `Carrier ${target.carrierId} is not installed.`;
      return;
    }
    run = target;
    runner = createRunner(target, {
      adapter: carrier,
      sink,
      history: new Set(history),
      onChange: (changed) => {
        persist();
        renderRun(runView, changed, actions);
        update();
      },
    });
    renderRun(runView, target, actions);
  };

  function update(): void {
    const text = rowInput.value;
    const view: RowViewModel =
      text.trim() === "" ? { canCreate: false, issues: [] } : rowViewModel(parseRows(text));
    shipment = view.canCreate ? parseRows(text).shipments[0] : undefined;
    renderResult(result, create, view);
    create.disabled = !view.canCreate || run !== undefined;
    rowInput.disabled = run !== undefined;
  }
  rowInput.addEventListener("input", update);
  create.addEventListener("click", () => {
    if (shipment === undefined || run !== undefined) {
      return;
    }
    status.textContent = "";
    attach(createRun(carrierSelect.value, [shipment]));
    void runner?.start();
    update();
  });

  root.replaceChildren(
    element("h1", { textContent: `ParcelHaste ${version}` }),
    element("label", { htmlFor: "carrier", textContent: "Carrier" }),
    carrierSelect,
    element("label", { htmlFor: "row", textContent: "Row" }),
    rowInput,
    result,
    create,
    runView,
    status,
  );

  void chrome.storage.session
    .get([STORAGE_KEYS.run, STORAGE_KEYS.history])
    .then((stored: Record<string, unknown>) => {
      const storedHistory = stored[STORAGE_KEYS.history];
      if (isHistory(storedHistory)) {
        history = storedHistory;
      }
      const storedRun = stored[STORAGE_KEYS.run];
      if (isRun(storedRun)) {
        // Never resume a submit on its own: a mid-flight job becomes interrupted (AC-004-14).
        attach(restoreRun(storedRun));
        persist();
        update();
      }
    });
}

const root = document.getElementById("app");
if (root !== null) {
  mount(root);
}
