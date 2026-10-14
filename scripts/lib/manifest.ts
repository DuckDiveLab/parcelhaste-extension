// One manifest definition, rendered per browser by scripts/build.ts.
export const BROWSERS = ["chrome", "firefox"] as const;
export type Browser = (typeof BROWSERS)[number];

export const GECKO_ID = "parcelhaste@duckdivelab.com";

const ICONS = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export function buildManifest(browser: Browser, version: string): Record<string, unknown> {
  const common = {
    manifest_version: 3,
    name: "ParcelHaste",
    version,
    description:
      "Creates shipping labels and customs declarations on carrier web portals from pasted order rows.",
    icons: ICONS,
    action: { default_title: "ParcelHaste", default_icon: ICONS },
    // Keep this list minimal; host permissions arrive with each carrier spec.
    permissions: ["storage", "downloads"],
  };

  if (browser === "chrome") {
    return {
      ...common,
      minimum_chrome_version: "116",
      background: { service_worker: "background.js" },
      side_panel: { default_path: "sidepanel/index.html" },
      permissions: [...common.permissions, "sidePanel"],
    };
  }

  return {
    ...common,
    background: { scripts: ["background.js"] },
    sidebar_action: {
      default_panel: "sidepanel/index.html",
      default_title: "ParcelHaste",
      default_icon: ICONS,
    },
    browser_specific_settings: { gecko: { id: GECKO_ID, strict_min_version: "128.0" } },
  };
}
