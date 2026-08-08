## Context

The existing core already wraps OpenSpec JSON reads, the extension already owns
native tree and diff adapters, and the shared UI already renders structured run
events. The missing layer is an integrated workflow that connects artifact
navigation, deterministic lifecycle commands, user-consented AI work, process
state, and safe recovery.

## Goals / Non-Goals

### Goals

- Make every relevant OpenSpec artifact discoverable from the extension.
- Give users explicit lifecycle and process controls with useful empty states.
- Support multiple changes without allowing conflicting mutations.
- Integrate AI through supported VS Code Chat APIs.
- Make each mutating run reviewable and reversable without discarding unrelated
  work.

### Non-Goals

- Reimplement the VS Code markdown editor, diff editor, source control UI, or
  built-in coding agent.
- Guarantee rollback after external processes modify files outside the captured
  workspace boundary.
- Allow simultaneous mutating runs for the same change.
- Make external CLI agents the default execution path.

## Decisions

### Hierarchical native navigation

The extension tree models workspace sections and artifact nodes. Change nodes
contain proposal, design, tasks, and delta spec files. Root nodes expose
`config.yaml`, active changes, archive, and canonical specs. Missing collections
produce actionable tree items rather than blank views.

Rejected alternative: retain three flat trees. It hides the artifact model and
cannot support contextual lifecycle actions coherently.

### Deterministic lifecycle service in core

Core owns create, validate, archive, unarchive, and guarded delete operations.
Adapters request typed operations and refresh from returned state. Archive uses
the OpenSpec CLI; unarchive and delete validate paths and require host-side user
confirmation before core mutation.

Rejected alternative: implement filesystem actions in the extension. That
would violate the shared-core boundary and diverge from standalone behavior.

### Per-change process scheduler

Core tracks queued, running, completed, failed, cancelled, and rolled-back
states. Mutating kinds acquire a change lock; read-only commands do not. The
scheduler is a separate API, so the existing command/event protocol and all
existing adapters remain backward compatible without protocol changes.

Rejected alternative: one global run. It prevents useful parallel work across
independent changes. Fully parallel mutation was rejected due to file conflicts.

### Checkpoint rollback

Before a mutating run, core records hashes and recoverable content for files in
the workspace, excluding Git internals, dependencies, build output, and files
outside configured limits. At completion it calculates the run delta. Rollback
requires an unchanged post-run fingerprint for every affected file; conflicts
are reported rather than overwritten.

Rejected alternative: `git reset` or automatic commits. Reset is destructive,
while automatic commits impose repository policy the user did not request.

### Native Chat participant

The extension registers `@openspec` with plan, implement, and review commands.
It supplies bounded change context and calls typed Workbench commands.
The model remains selected and authorized through VS Code. Repository content
is treated as untrusted data and cannot alter tool permissions or paths.

Rejected alternative: a custom agent picker. It duplicates VS Code model UX and
revives environment-specific CLI orchestration.

## Risks / Trade-offs

- Proposed Chat APIs vary by VS Code release. Mitigation: use stable APIs in the
  pinned engine range and degrade to copyable prompts when no model is available.
- Checkpoints can consume disk space. Mitigation: limits, retention, and explicit
  cleanup after archive/delete.
- Archive and rollback are destructive. Mitigation: previews, confirmation,
  workspace sandboxing, and conflict detection.
- Multi-root workspaces are ambiguous. Mitigation: resolve the root from the
  selected tree item where available. Full multi-root tree aggregation remains
  a future enhancement.

## Verification

- Core typecheck, lint, and 96 unit tests passed, including workspace discovery,
  lifecycle traversal protection, per-change scheduling, checkpoints, rollback,
  and conflict refusal (tasks 1.1-2.3).
- Extension typecheck, lint, and 41 unit tests passed, including trees, lifecycle
  commands, Chat routing, managed implementation sessions, and process controls
  (tasks 3.1-5.3).
- The extension passed its five-scenario integration suite in a real VS Code
  1.132 Extension Development Host (task 7.2).
- VSIX 0.2.0 was packaged, installed, and verified through the VS Code CLI
  (task 7.4).

## Remaining Risks

- VS Code owns Agent-mode execution, so completion is intentionally explicit:
  the user selects Finish Implementation & Review when Agent work ends (task
  4.3). The extension cannot safely infer completion of the built-in agent.
- Checkpoints are in-memory and bounded. Reloading the extension discards
  rollback history, which is documented behavior for this release (task 2.3).
- Full multi-root tree aggregation is not part of the VS Code-first 0.2.0 scope;
  commands operate on the active Workbench root (task 3.3).
