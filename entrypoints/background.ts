// Background service worker (Chrome) / event page (Firefox). Thin glue only:
// the queue runs in the side panel page (ADR-0003), never here.

// chrome.sidePanel exists in Chrome only; Firefox opens the sidebar itself.
const sidePanel = (chrome as { sidePanel?: typeof chrome.sidePanel }).sidePanel;

chrome.runtime.onInstalled.addListener(() => {
  sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});
