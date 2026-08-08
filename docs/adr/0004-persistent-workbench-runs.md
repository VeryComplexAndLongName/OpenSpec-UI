# 0004: Persistent Workbench Runs and Delivery Parity

Status: Accepted

Date: 2026-08-08

## Context

ADR 0003 introduced process scheduling and checkpoint rollback, but both are
currently held in extension-host memory. Reloading VS Code loses process
history and rollback state. Its per-change mutation locks also allow two Agent
sessions to modify the same workspace files while workspace-wide checkpoints
are being captured, so one run can accidentally include another run's edits.

The repository ships standalone and VS Code delivery targets. ADR 0001 makes
core the source of truth, but it does not require host-specific interfaces such
as native Chat to be identical. Persistent run behavior must be reusable by
both targets even when their adapters are delivered at different times.

Package versions are already the release source of truth, but the relationship
between shared behavior and delivery versions needs to be explicit.

## Decision

1. Core owns a versioned, transport-neutral run journal stored under
   `.openspec-ui/`. Journal updates use write-then-rename replacement so a
   partial write cannot replace the last valid state.
2. Checkpoints have a serializable representation owned by core. The journal
   stores enough pre-run and finalized state to recover rollback after a host
   restart. Repository-relative paths remain sandboxed to the checkpoint root.
3. On startup, unfinished persisted runs become `interrupted`. A host may
   finalize the recovered checkpoint against the current workspace and offer
   explicit review or rollback; it must not silently resume AI execution.
4. Until mutations are isolated by worktrees or an equivalent filesystem
   boundary, the scheduler permits only one mutating run per workspace.
   Read-only operations remain concurrent.
5. Checkpoint capture records excluded directories and skipped files. Hosts
   must disclose incomplete coverage before claiming rollback protection.
6. Package-level versions are authoritative. Shared behavior changes bump
   `@openspec-ui/core`; each delivery package is bumped only when its shipped
   behavior changes. The private root package remains `0.0.0` and is not a
   release version.
7. Persistence and recovery logic ships in core and is available to both
   delivery targets. This change adds the VS Code adapter. Standalone parity is
   tracked explicitly as follow-up work rather than implied by shared code.

## Rejected Alternatives

### Persist only in VS Code workspaceState

Rejected because binary checkpoint content can exceed extension state limits
and would make the core behavior unavailable to standalone.

### Continue per-change mutation concurrency

Rejected because change identifiers do not isolate source files. Two changes
can modify the same file, invalidating workspace-wide checkpoint ownership.

### Automatically resume interrupted Agent sessions

Rejected because VS Code owns Agent execution and user consent. The extension
cannot safely reconstruct or continue that external conversational state.

### Keep one synchronized version for all packages

Rejected because the packages have different public contracts and release
cadences. Package-level SemVer communicates impact more accurately.

## Consequences

- A reload no longer removes process history or finalized rollback data.
- Interrupted runs require explicit user review and cannot be presented as
  completed work.
- Mutation throughput is lower until true workspace isolation exists.
- Checkpoint journals consume workspace storage and require bounded retention.
- Standalone and VS Code may temporarily expose different host UX, but shared
  behavior and the remaining parity work are explicit and testable.
