## Context

`WorkbenchRunJournal`, checkpoint serialization, and rollback already live in
core. The extension owns a host adapter, but standalone does not load journals
or expose recovery controls.

## Decisions

- Add a transport-neutral `WorkbenchRecoveryService` in core. It loads a
  workspace journal, converts unfinished runs to interrupted through the
  scheduler, finalizes recovered checkpoints, and owns rollback/cleanup.
- Server caches one initialized service per authorized workspace and waits for
  service readiness inside each request.
- Expose POST endpoints because all requests carry a workspace root and use the
  authenticated JSON request boundary.
- Cleanup accepts a retention cutoff and removes matching process/checkpoint
  pairs atomically through the existing journal replacement strategy.
- Standalone renders a compact process table and explicit details, rollback,
  and cleanup actions. Rollback is never automatic.

## Risks

- Finalizing an interrupted checkpoint scans the workspace and may take time;
  the UI exposes loading state.
- Rollback may report conflicts when files changed after checkpoint finalization.
