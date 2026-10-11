# Proposal: Process Ledger and Orphan Detection

## Why

OpenSpec UI spawns agent and tool processes that can outlive a host restart,
for example after a VS Code `Developer: Reload Window`. The host that held
their handles is gone, so it cannot stop them, and their PID alone is not a
safe identity because the OS reuses PIDs. The user has repeatedly found
surviving processes consuming CPU and memory.

## What Changes

- Record a synchronous process snapshot for every spawn through the shared
  adapters: PID, OS start time, executable, hostname, cwd, change, and a
  secret-free command-line hash.
- Mark records exited on normal close and keep the ledger durable across
  host restarts, keyed by canonical repository identity and hostname.
- Re-verify the snapshot against the operating system before any kill and
  terminate through the existing process-tree helper.
- Surface orphaned and overdue processes as read-only Compliance findings.
- Add an explicit, confirmable kill in the existing recovery/processes
  surface, never in Compliance.

## Capabilities

### New Capabilities

- `process-ledger`: durable process snapshots, orphan detection and safe
  re-verified termination.

### Modified Capabilities

- `openspec-workbench`: recovery/processes surfaces expose ledger-backed
  overdue and orphaned processes with a confirmation-gated kill.
- `repository-compliance`: a read-only process-overdue/orphan rule and
  findings that never terminate processes.

## Impact

`packages/core` owns the ledger, snapshot capture and re-verification.
`packages/extension` and `packages/server` reuse the shared spawn adapters and
expose the existing recovery surface. ADR-0050 records the identity and
kill-safety decisions.
