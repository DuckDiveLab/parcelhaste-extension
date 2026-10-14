# ADR-0003: The queue runs in the side panel

- Status: accepted
- Date: 2026-10-14

## Context

Chrome terminates idle MV3 background service workers after about 30 seconds and may kill them
mid-task. A run of shipments takes minutes and holds state (jobs, retries, downloaded labels).

## Decision

The queue orchestrator runs in the side panel page (`entrypoints/sidepanel/`), which stays alive
while the panel is open. The background worker is thin glue: it opens the panel and relays events
when a page cannot talk to the panel directly. Run state is persisted to `storage.local` so a
closed panel can resume.

## Consequences

- Closing the side panel pauses the run; the UI must say so.
- Content scripts for the `dom` strategy are injected and driven from the panel through the
  extension messaging APIs.
