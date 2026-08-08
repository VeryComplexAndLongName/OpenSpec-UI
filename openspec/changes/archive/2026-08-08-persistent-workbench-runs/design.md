# Persistent Workbench Runs Design

## Context

Workbench process records and checkpoints are currently in-memory Maps created
on extension activation. The scheduler locks by change id while checkpoints
scan the entire workspace. This means reload loses recovery state and two
nominally independent changes can produce overlapping checkpoint deltas.

## Goals / Non-Goals

### Goals

- Preserve process history and rollback state across extension reloads.
- Recover unfinished implementation sessions without silently resuming AI.
- Prevent overlapping workspace mutations.
- Make partial checkpoint coverage visible and machine-readable.
- Keep persistence independent of VS Code and HTTP transports.

### Non-Goals

- Resume a VS Code Agent conversation after reload.
- Add standalone process UI in this change.
- Isolate mutations in Git worktrees.
- Persist arbitrary command stdout without retention limits.
- Change the existing command/event protocol.

## Decisions

### Versioned atomic journal in core

Core writes a JSON document under `.openspec-ui/workbench-runs.json`. A
version field permits future migrations. Updates are serialized and use a
temporary file followed by rename. Corrupt or unsupported journals fail with
an actionable error instead of being silently overwritten.

Rejected alternative: VS Code `workspaceState`. It is host-specific and poorly
suited to bounded binary checkpoint content.

### Serializable checkpoints with coverage

Core converts checkpoint Maps and Buffer content to an explicit JSON shape
using base64. Capture records skipped oversized files and excluded directory
names. The extension can therefore distinguish full from partial rollback
coverage.

Rejected alternative: serialize Maps implicitly. JSON would discard their
structure and make schema migration ambiguous.

### Interrupted-run recovery

Activation loads persisted records. Queued/running records are converted to
`interrupted`. Their implementation checkpoint is finalized against the
current workspace, persisted, and exposed for explicit rollback. Completed,
failed, cancelled, rolled-back, and interrupted history is retained within a
bounded newest-first limit.

Rejected alternative: mark unfinished work completed. Completion cannot be
inferred after a host crash.

### Workspace mutation lock

The scheduler uses one mutation lock for the workspace rather than locks by
change. Read-only operations remain concurrent.

Rejected alternative: retain change locks. Changes are planning units, not
filesystem isolation boundaries.

### Delivery parity and versions

Persistence is core-owned. The VS Code adapter ships now because it owns the
existing Processes view. Standalone adoption is a named follow-up and must use
the same journal API. Core and extension receive minor version bumps; server
and webui versions remain unchanged because their shipped behavior does not.

Rejected alternative: bump every package together. It would claim standalone
behavior changed when it did not.

## Risks / Trade-offs

- Base64 increases checkpoint storage size. Existing capture limits and bounded
  journal retention constrain growth.
- Finalizing an interrupted checkpoint includes all workspace edits made since
  capture. Recovery labels the run interrupted and requires explicit action.
- Atomic rename semantics vary by platform. The implementation removes an old
  destination only as a Windows fallback after the new temporary file is
  complete.
- Global mutation serialization reduces throughput but prevents cross-run
  checkpoint contamination.

## Protocol Compatibility

The command protocol and event protocol are unchanged. Server and extension
adapters remain backward compatible.

## Verification

- Workspace-wide typecheck and lint passed (task 4.2).
- All 240 unit and contract tests passed: core 103, extension 45, server 18,
  and webui 74 (tasks 4.1 and 4.2).
- The existing server/webui contract suites passed without changes because the
  command/event protocol is unchanged (task 4.2).
- The extension passed all five scenarios in a real VS Code 1.132 Extension
  Development Host, then packaged and installed as version 0.3.0 (task 4.4).
- Strict OpenSpec validation passed after the completed task ledger (task 4.3).

## Remaining Risks

- Standalone does not yet expose Processes or recovery controls. The shared
  journal engine is available in core and the gap is explicitly represented in
  the delivery capability matrix delivered by task 3.1.
- Windows may require the documented remove-and-rename fallback when replacing
  an existing journal. The complete temporary file is retained until the final
  rename attempt, but a host crash during that fallback can leave no primary
  journal.
