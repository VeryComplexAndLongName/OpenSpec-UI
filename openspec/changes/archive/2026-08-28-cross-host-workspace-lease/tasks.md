## 1. Core: workspace lease module

- [x] 1.1 Add `packages/core/src/workspace-lease.ts`: `WorkspaceLeaseDocument`
  (version 1, `holderId`/`hostKind`/`hostname`/`pid`/`acquiredAt`/`heartbeatAt`)
  and a `WorkspaceLeaseManager` class reading/writing
  `<root>/.openspec-ui/workspace.lease.json` via write-then-rename atomic
  replacement, mirroring `WorkbenchRunJournal.write()`'s
  temp-file-then-rename-with-EEXIST/EPERM-retry sequence exactly (not a
  second, independent implementation).
- [x] 1.2 `WorkspaceLeaseManager.acquireOrRenew()`: succeeds if no lease
  exists, the existing lease belongs to this manager's own `holderId`, or
  the existing lease's `heartbeatAt` is older than the staleness window
  (20s, judged by the *evaluating* manager's own threshold — not
  necessarily the original holder's); otherwise returns the current
  holder's details without writing.
- [x] 1.3 `WorkspaceLeaseManager.release()`: clears the lease file only if
  it is currently held by this manager's own `holderId`.
- [x] 1.4 Export `WorkspaceLeaseManager` and its types from
  `packages/core/src/index.ts`.

## 2. Core: scheduler integration

- [x] 2.1 `WorkbenchProcessScheduler`'s constructor accepts an optional
  second parameter carrying a lease manager; omitted, behavior is
  unchanged from today (in-memory `mutationLocked` only, no filesystem
  access) — every existing call site and test keeps compiling and
  passing with no changes.
- [x] 2.2 In `run()`'s mutating branch, before setting
  `mutationLocked = true`: if a lease manager is present, call
  `acquireOrRenew()`. If it reports another live holder, finish the
  process as `failed` immediately (never transitioning through
  `running`), with `error` naming the other host's `hostKind`/`hostname`/
  `pid` and time since its last heartbeat — do not queue it.
- [x] 2.3 While a mutating process is `running` under a lease manager,
  renew the lease every 5s until the process finishes.
- [x] 2.4 In the mutating branch's existing `finally` block (alongside
  `mutationLocked = false`), release the lease if one was acquired. Also
  restructured `finish()`'s call site to happen *after* this `finally`
  block, not inside the preceding `try`/`catch` — releasing the lease is
  now genuinely asynchronous, and `completion` must not resolve before
  that release has actually happened (found by a real test race: a
  second scheduler's mutating run, started right after `await
  first.completion`, was intermittently still seeing the first host's
  lease as live).
- [x] 2.5 When `acquireOrRenew()` reclaims a stale lease from a different
  `holderId`, surface that reclamation (not a plain acquisition) through
  the existing `report`/progress channel so the host can disclose it.

## 3. Host wiring

- [x] 3.1 `WorkbenchRecoveryService.open()`
  (`packages/core/src/workbench-recovery.ts`) constructs a
  `WorkspaceLeaseManager` for `root` with `hostKind: "standalone-server"`
  and passes it to its internal scheduler (`initialize()` and
  `cleanupBefore()`'s scheduler reconstruction).
- [x] 3.2 `packages/extension/src/extension.ts` `activate()` constructs a
  `WorkspaceLeaseManager` for `workspaceRoot` with
  `hostKind: "vscode-extension"` (only when `workspaceRoot` is defined,
  matching the existing journal-construction guard) and passes it to the
  scheduler it constructs directly.
- [x] 3.3 Confirmed `deactivate()` (`extension.ts`) and the standalone
  server's `close()` (`server.ts`) do not need to release a lease
  themselves — release already happens per-run in the scheduler's
  `finally` block (2.4), so no lease is ever held across a clean
  shutdown with no active mutating run.

## 4. Wire contract fix

- [x] 4.1 Export `COMMAND_KINDS` (a `readonly CommandKind[]`) from
  `packages/core/src/protocol.ts`, next to the `CommandKind` type it
  enumerates.
- [x] 4.2 `packages/server/src/wire.ts`'s `isCommandLike` imports and uses
  that exported array instead of its own locally declared
  `COMMAND_KINDS`.

## 5. Standalone live execution wiring (scope expansion — discovered mid-implementation)

`packages/server/src/websocket.ts`'s `streamRun` never touched
`WorkbenchProcessScheduler` at all — it called `runner.run(command)`
directly for every command kind, so ADR 0004's mutation isolation was
unenforced for the standalone server's own live `implement` execution,
same-host, before this change (see ADR 0010 Context/Decision 7). This
section closes that gap as part of this same change; it is what makes
sections 1–4 actually protect the real cross-host scenario, not just
`WorkbenchRecoveryService`'s rollback/cleanup calls.

- [x] 5.1 Add `WorkbenchRecoveryService.runMutating(id, operation,
  changeName, execute)` (`workbench-recovery.ts`): a thin pass-through to
  `scheduler.start({ ..., mutating: true, execute }).completion`,
  persisting the terminal state afterward via the existing private
  `persist()`. No checkpoint capture (see design.md Non-Goals).
- [x] 5.2 `packages/server/src/websocket.ts`'s `streamRun` branches on
  `command.kind !== "implement"` first (every other kind unchanged, direct
  through the `AgentRunner`, exactly as before). For `implement`, resolve
  the `WorkbenchRecoveryService` for `command.cwd` and call
  `runMutating()`, with `execute` streaming the `AgentRunner`'s events to
  the socket as they occur (`changeName` derived from
  `path.basename(command.context.changeDir)`).
- [x] 5.3 If the returned process is `failed` with `startedAt ===
  undefined` (blocked before the agent ever ran — a lease conflict, or a
  duplicate `runId` throwing synchronously from `scheduler.start()`),
  synthesize and send one `failed` `Event` naming the reason — the socket
  otherwise never received anything for that attempt.
- [x] 5.4 `packages/server/src/server.ts`: pass `resolveRecoveryService`
  into `handleSocketMessage`.

## 6. Tests

- [x] 6.1 `workspace-lease.test.ts`: acquire when absent, renew by the
  same holder (keeping `acquiredAt`, advancing `heartbeatAt`), refuse a
  live foreign holder, reclaim a stale foreign holder, release only when
  self-held, and a clean acquire immediately after release.
- [x] 6.2 `process-scheduler.test.ts`: cases for a lease-backed scheduler
  — foreign live lease rejects a mutating run as `failed` without
  queuing (`startedAt` stays `undefined`); own or absent lease behaves
  exactly as before; stale foreign lease is reclaimed and disclosed
  (`process.progress` contains "Reclaimed"); lease release on completion
  lets a second scheduler then acquire; read-only runs are never gated
  by the lease at all. Existing no-lease test cases re-run unchanged,
  confirming the optional parameter is truly backward compatible.
- [x] 6.3 `wire.test.ts`: `isCommandLike` accepts every `CommandKind` from
  the shared `COMMAND_KINDS` export, rejects an unknown kind, rejects a
  value missing required fields.
- [x] 6.4 `server.test.ts`: fixed the WS `implement` tests to use a real,
  tracked temp workspace instead of the fake `/workspace/repo` (that fake
  path was harmless before section 5, but now real filesystem calls
  happen for `implement` — the original tests were, until fixed,
  silently writing `.openspec-ui/` files to `C:\workspace\repo\`, outside
  any sandbox; see design.md's Risks for the full account). Added a real
  two-server-process test over actual WebSocket connections: a second
  server's `implement` attempt is blocked (one `failed` event, reason
  naming "standalone server") while the first server's run is still
  active on the same real workspace root, and both servers' journals
  agree once the first finishes.

## 7. Verification

- [x] 7.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [x] 7.2 `npm run test` (`npm run verify`) passes workspace-wide,
  including every new/modified test file above.
- [~] 7.3 Manual smoke test: no interactive VS Code host was available in
  this environment to drive the extension side by hand, so this wasn't
  performed literally as written. The closest available substitute was
  done instead (task 6.4's test): two real `createServer()` processes
  (real ports, real WebSocket connections) against the same real
  temp-directory workspace root, coordinating purely through the real
  `.openspec-ui/workspace.lease.json` file on disk — the same primitive
  two actual OS processes would use. That test passes: the second
  server's `implement` attempt is blocked with an immediate `failed`
  event naming the first host, and succeeds once the first finishes.
  Still open: an actual two-OS-process run (one real standalone server,
  one real VS Code extension window) against a shared workspace, by a
  human with a VS Code UI available.
- [x] 7.4 Proposed a changeset (`.changeset/cross-host-workspace-lease.md`)
  for `@openspec-ui/core`, `@openspec-ui/server`, and `openspec-ui-vscode`
  (minor each) and applied it via `npx changeset version`: core
  0.29.0→0.30.0, server 1.10.0→1.11.0, extension 0.26.0→0.27.0.
- [x] 7.5 Ran `openspec change validate --strict cross-host-workspace-lease`
  — valid.
