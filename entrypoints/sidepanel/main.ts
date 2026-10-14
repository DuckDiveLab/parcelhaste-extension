// Side panel entry point. Plain DOM, no framework (ADR-0002). Thin glue only:
// views and the queue runner arrive with specs 002 and 004.
import { carriers } from "../../src/carriers/index.ts";

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function render(root: HTMLElement): void {
  const { version } = chrome.runtime.getManifest();
  const carrierSelect = element("select", { id: "carrier" });
  for (const carrier of carriers) {
    carrierSelect.append(
      element("option", { value: carrier.info.id, textContent: carrier.info.name }),
    );
  }

  root.replaceChildren(
    element("h1", { textContent: `ParcelHaste ${version}` }),
    element("p", { className: "muted", textContent: "Pre-alpha. Nothing is wired up yet." }),
    element("label", { htmlFor: "carrier", textContent: "Carrier" }),
    carrierSelect,
    element("p", {}, [
      element("textarea", {
        placeholder: "Paste one row from the export here (spec 002).",
        disabled: true,
      }),
    ]),
    element("button", { type: "button", textContent: "Create label", disabled: true }),
  );
}

const root = document.getElementById("app");
if (root !== null) {
  render(root);
}
