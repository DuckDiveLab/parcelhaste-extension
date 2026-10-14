// Background service worker. Thin glue only: the queue runs in the side panel page
// (ADR-0003), never here, because Chrome stops idle workers after about 30 seconds.

chrome.runtime.onInstalled.addListener(() => {
  // Open the side panel when the toolbar icon is clicked.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});
