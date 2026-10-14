// Side panel entry point. Plain DOM, no framework (ADR-0002). Thin glue: parsing lives in
// src/inputs; submitting to the carrier and the queue arrive with specs 003 and 004.
import { carriers } from "../../src/carriers/index.ts";
import { parseExportRows } from "../../src/inputs/row.ts";
import { type RowViewModel, rowViewModel } from "../../src/inputs/row-view.ts";

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
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
    placeholder: "Paste one order's row (or rows) from the shipping export",
  });
  const weightInput = element("input", {
    id: "weight",
    type: "text",
    inputMode: "decimal",
    placeholder: "Weight: grams, or kilograms below 50",
  });
  const create = element("button", { type: "button", textContent: "Create label", disabled: true });
  const result = element("div", { id: "result" });
  const status = element("p", { className: "muted" });

  const update = (): void => {
    const text = rowInput.value;
    const view: RowViewModel =
      text.trim() === ""
        ? { canCreate: false, issues: [] }
        : rowViewModel(parseExportRows(text, { weight: weightInput.value }));
    renderResult(result, create, view);
  };
  rowInput.addEventListener("input", update);
  weightInput.addEventListener("input", update);
  create.addEventListener("click", () => {
    status.textContent = "Submitting to the carrier arrives with specs 003 and 004.";
  });

  root.replaceChildren(
    element("h1", { textContent: `ParcelHaste ${version}` }),
    element("label", { htmlFor: "carrier", textContent: "Carrier" }),
    carrierSelect,
    element("label", { htmlFor: "row", textContent: "Row" }),
    rowInput,
    element("label", { htmlFor: "weight", textContent: "Weight" }),
    weightInput,
    result,
    create,
    status,
  );
}

const root = document.getElementById("app");
if (root !== null) {
  mount(root);
}
