import assert from "node:assert/strict";
import { test } from "node:test";
import { buildManifest } from "./manifest.ts";

test("chrome manifest uses a service worker and the side panel", () => {
  const manifest = buildManifest("chrome", "1.2.3");
  assert.equal(manifest["manifest_version"], 3);
  assert.equal(manifest["version"], "1.2.3");
  assert.deepEqual(manifest["background"], { service_worker: "background.js" });
  assert.deepEqual(manifest["side_panel"], { default_path: "sidepanel/index.html" });
  assert.ok((manifest["permissions"] as string[]).includes("sidePanel"));
  assert.equal(manifest["sidebar_action"], undefined);
});

test("firefox manifest uses background scripts, sidebar_action and a gecko id", () => {
  const manifest = buildManifest("firefox", "1.2.3");
  assert.deepEqual(manifest["background"], { scripts: ["background.js"] });
  assert.ok(manifest["sidebar_action"]);
  assert.equal(manifest["side_panel"], undefined);
  assert.ok(!(manifest["permissions"] as string[]).includes("sidePanel"));
  const gecko = (manifest["browser_specific_settings"] as { gecko: { id: string } }).gecko;
  assert.match(gecko.id, /@/);
});
