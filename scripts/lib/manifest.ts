// The Chrome MV3 manifest, rendered by scripts/build.ts. Chrome is the only target (ADR-0002).
const ICONS = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export function buildManifest(version: string): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: "ParcelHaste",
    version,
    description:
      "Creates shipping labels and customs declarations on carrier web portals from pasted order rows.",
    minimum_chrome_version: "116",
    icons: ICONS,
    action: { default_title: "ParcelHaste", default_icon: ICONS },
    background: { service_worker: "background.js" },
    side_panel: { default_path: "sidepanel/index.html" },
    // Keep this list minimal; host permissions arrive with each carrier spec.
    permissions: ["storage", "downloads", "sidePanel"],
  };
}
