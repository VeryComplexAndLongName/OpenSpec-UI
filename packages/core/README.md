# @openspec-ui/core

The host-neutral source of truth for OpenSpec UI behavior. This package owns the
command/event protocol, agent execution and security, OpenSpec and Git wrappers,
change state, checkpoints, scheduling, persistence, and recovery. It has no HTTP
framework or VS Code API dependency.

Implementation governance lives in `openspec/README.md`; the original capability
is specified under `openspec/changes/execution-core/`.

## Modules

- `protocol.ts`: command and event discriminated unions.
- `agent-runner.ts`: runner and adapter boundaries with inline security and audit checks.
- `security.ts`: allowlist, workspace sandbox, context boundary, and audit log.
- `agents/`: Claude, Copilot, Codex, Gemini, and OpenAI-compatible local adapters.
- `change-state.ts`: derived draft, in-progress, implemented, and archived state.
- `openspec.ts`: validated wrappers for structured OpenSpec CLI commands.
- `git.ts`: the Git operations required by the workbench.
- `checkpoint.ts`: capture, finalize, serialize, and conflict-safe rollback.
- `process-scheduler.ts`: mutation scheduling and process lifecycle.
- `workbench-run-journal.ts`: versioned, atomic persistent run state.

## Security Defaults

Core does not hardcode an agent allowlist. Hosts provide `AllowlistConfig` for
the active workspace. An absent agent or command is denied by default.

## Derived Change State

- `archived`: the change directory is under an `archive` path segment.
- `draft`: `tasks.md` is absent, has no checklist items, or has no completed items.
- `in-progress`: some checklist items are complete.
- `implemented`: all checklist items are complete.

State is computed on demand and is not written into the OpenSpec format.
