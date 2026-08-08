## 1. Core lifecycle and workspace model

- [x] 1.1 Add typed workspace discovery for config, active changes, archive,
      canonical specs, and change artifacts with unit tests.
- [x] 1.2 Add OpenSpec archive wrapper and guarded unarchive/delete operations
      with sandbox and traversal tests.
- [x] 1.3 Add actionable diagnostics for missing CLI and uninitialized roots.

## 2. Process scheduler and recovery

- [x] 2.1 Add multi-run process state and per-change mutation locks with tests.
- [x] 2.2 Add a scheduler API without changing the backward-compatible command/
      event protocol, with adapter regression tests.
- [x] 2.3 Add bounded run-scoped checkpoint capture, diff, conflict detection,
      rollback, retention, and security tests.

## 3. Native VS Code Workbench

- [x] 3.1 Replace flat navigation with hierarchical artifact nodes and useful
      empty states for Archive and Specs.
- [x] 3.2 Add create, validate, archive, unarchive, delete, open config, and
      refresh commands with confirmations and command tests.
- [x] 3.3 Add file-system refresh notifications for external editor, CLI, and
      Agent changes.
- [x] 3.4 Add native task progress, diff review, checkpoint rollback, and Agent
      handoff actions.

## 4. Native Chat integration

- [x] 4.1 Register an `@openspec` Chat Participant with plan, implement, review,
      status, and validate commands.
- [x] 4.2 Add bounded prompt context and typed actions without executing repository
      text as instructions.
- [x] 4.3 Add model-error fallback, cancellation, explicit Agent handoff, and tests.

## 5. Process dashboard

- [x] 5.1 Add scheduler-backed process lists, progress, cancellation, history,
      result summaries, and failure details.
- [x] 5.2 Visualize change-scoped concurrent run states in a native Processes view.
- [x] 5.3 Add checkpoint/rollback controls and cross-layer tests.
- [x] 5.4 Keep lifecycle, scheduler, and checkpoint APIs in shared core for reuse
      by standalone mode without requiring UI parity in this VS Code-first release.

## 6. Release readiness

- [x] 6.1 Update extension README, changelog, command names, touched comments,
      icon metadata, and Marketplace positioning.
- [x] 6.2 Document first-run requirements, initialization, Chat availability,
      archive/spec behavior, and rollback conflicts.
- [x] 6.3 Bump affected package versions according to semver policy.

## 7. Verification

- [x] 7.1 Run affected-package typecheck, lint, and unit/contract tests.
- [x] 7.2 Run extension integration tests in a real VS Code host.
- [x] 7.3 Verify lifecycle, concurrency, Chat routing, checkpoint diff, rollback,
      and conflict refusal through automated scenarios plus live-host smoke tests.
- [x] 7.4 Package and install the VSIX, then verify Marketplace assets and all
      contributed commands/views.
