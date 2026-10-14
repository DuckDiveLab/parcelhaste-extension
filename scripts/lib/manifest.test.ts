import assert from "node:assert/strict";
import { test } from "node:test";
import { buildManifest } from "./manifest.ts";

test("manifest is Chrome MV3 with a service worker, the side panel and minimal permissions", () => {
  const manifest = buildManifest("1.2.3");
  assert.equal(manifest["manifest_version"], 3);
  assert.equal(manifest["version"], "1.2.3");
  assert.deepEqual(manifest["background"], { service_worker: "background.js" });
  assert.deepEqual(manifest["side_panel"], { default_path: "sidepanel/index.html" });
  assert.deepEqual(manifest["permissions"], ["storage", "downloads", "sidePanel"]);
  assert.equal(manifest["browser_specific_settings"], undefined);
});
