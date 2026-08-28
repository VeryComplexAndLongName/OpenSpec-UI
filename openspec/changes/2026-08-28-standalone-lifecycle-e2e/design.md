## Context

Researched directly against this codebase before writing any test (a
prior session mistake — assuming a mechanism existed without checking —
is exactly what this research avoided repeating):

- `AiPanel.tsx`'s agent picker (`data-testid="agent-picker"`) renders
  options from `AGENT_REGISTRY` (`packages/core/src/agents/registry.ts`)
  — `claude-cli`/`copilot-cli`/`codex-cli`/`gemini-cli`/`local-llm` — not
  from whatever keys a test's `runners` map happens to use.
  `DEFAULT_AGENT_ID` is `"claude-cli"`. For non-agent commands
  (`status`/`list`/`show`/`validate`), the panel sends `agentId:
  undefined`, and `resolveRunner()` (`packages/core/src/
  default-runners.ts`) falls back to `runners.get(DEFAULT_AGENT_ID)`. A
  single fake runner registered under `"claude-cli"` therefore serves
  every command the panel ever sends, with no agent-picker interaction
  needed.
- Tab labels come from `packages/webui/src/host-embed.ts`: `"Run a
  Command"` (`AiPanel`) and `"Processes and Recovery"`
  (`ProcessesView`), matching the existing `standalone.spec.ts`'s
  `getByRole("tab", { name: ... })` pattern exactly.
- `ProcessesView.tsx`'s table has one "Review" button per row (opens
  `details`, showing `<h3>{operation}: {state}</h3>` and a changed-files
  `<li>{kind}: {path}</li>` list) and one "Rollback files" button,
  disabled unless `details.canRollback`; results post through a
  `role="status"` paragraph.
- `WorkbenchRecoveryService.runMutating()` (`workbench-recovery.ts`)
  persists only after `execute` finishes — confirmed by reading it
  directly, not assumed. See proposal.md's Why for the consequence.
- `server.test.ts`'s existing rollback tests already establish the exact
  seeding fixture: write files, `captureCheckpoint`, mutate files,
  `finalizeCheckpoint`, then `new WorkbenchRunJournal(cwd).save({
  processes: [...], checkpointSessions: [...] })` — all before the
  server/recovery-service ever opens that root (`resolveRecoveryService`
  lazily opens and caches one `WorkbenchRecoveryService` per root on
  first use, so seeding must happen first).
- `packages/server/playwright.config.ts` has no `webServer` block;
  every existing spec manually calls `createServer(...)` +
  `server.listen()` in `beforeAll` and `server.close()` in `afterAll`,
  matching `standalone.spec.ts`'s own pattern exactly.

## Goals / Non-Goals

**Goals:**
- Prove, through the real browser UI (not just vitest), that a mutating
  run's events arrive and render in order, that interrupted-run recovery
  and rollback actually work end-to-end, and that the cross-host lease's
  user-facing failure message actually reaches a real user.
- Use a fake `AgentRunner`, never a real CLI agent — matches
  `server.test.ts`'s own established precedent and keeps these tests
  deterministic and credential-free.
- Document current behavior honestly where a scenario's original name
  implied something that doesn't exist yet (reconnect; crash recovery
  for WS-driven runs) rather than silently building it or silently
  dropping the scenario.

**Non-Goals:**
- Not building WebSocket auto-reconnect in `FetchTransport`. That is new
  production behavior, not a test — a separate decision if ever wanted.
- Not adding checkpoint capture to the standalone server's WS-driven
  `implement` path (a Non-Goal `openspec/changes/archive/
  2026-08-28-cross-host-workspace-lease/design.md` already scoped out).
  The "host stopped during a run" test proves the current gap, it does
  not close it.
- Not testing VS Code extension concurrency in this Playwright suite —
  Playwright cannot drive a VS Code window. Extension-side concurrent
  testing needs the VS Code Extension Test Runner (already used by
  `packages/extension/src/test/`), tracked as a separate, later concern
  if wanted.
- Not using a real CLI agent (Claude CLI, etc.) in any of these specs.

## Decisions

### One fake runner, keyed `"claude-cli"`, kind-aware

Rather than a fixed event script (like `standalone.spec.ts`'s sibling
`server.test.ts` uses for its WS contract tests), the fake runner
switches on `command.kind`: for `"list"` it yields one `stdout` event
whose chunk is `JSON.stringify({ changes: [{ name: changeName }] })` (the
exact shape `AiPanel.tsx`'s `parseChangeNamesFromStdout` expects, so the
change picker actually populates from a real WS round-trip); for
`"implement"` it yields `started` → `progress` → `stdout` → `completed`
with a deliberately delayed `completed` (an `await` gate) so tests can
inspect mid-run state (an active lease, a killed server, a dropped
connection) before letting it finish.

### Seeding the journal directly on disk, before `server.listen()`

Matches `server.test.ts`'s existing rollback fixture exactly (see
Context). This is the only way to get a `canRollback: true` process in
front of the standalone UI at all, since the server's own WS `implement`
path never produces one (Non-Goals).

### Killing a server mid-run means severing the client connection, then calling `server.close()` — not `process.exit()`

These tests run `createServer()` in-process (matching every existing
spec, per Context — no `webServer` block, no child process spawn). A
literal OS-level kill isn't available without spawning the server as a
separate child process, which no existing e2e spec does. `server.close()`
alone does not reproduce a kill faithfully — see the Risks section's
`OpenSpecUiServer.close()` finding: it hangs waiting for the client to
disconnect on its own. These tests close the client side of the
connection first (`fixtures/intercept-websocket.ts`), then `close()`
the server — the *outcome* still matches a real kill for what this test
actually asserts: nothing the WS `implement` path wasn't already only
going to persist at completion is lost either way (see Context), so the
next server against that workspace root sees nothing for that run.
Rejected a real child-process spawn as unnecessary complexity for a
result this combination already reproduces faithfully enough for the
assertion being made.

### Concurrent-hosts test uses two `browser.newContext()` pages, not two `browser` instances

Two isolated `BrowserContext`s (Playwright's own multi-user simulation
primitive) against two different server ports is sufficient to prove two
independent "users"/hosts; a second full `Browser` launch would add
startup cost for no additional coverage, since context isolation already
guarantees separate storage/cookies/connections.

### Generous, explicit per-test timeouts

Matches `standalone.spec.ts`'s own precedent (`test.setTimeout(60000)`,
with an inline comment about CLI-spawn wall-clock variance on a loaded
CI runner) — these new specs spawn a real Chromium instance per test and
do real filesystem I/O for seeding, so default Playwright timeouts are
too tight the same way the existing test already found.

## Risks / Trade-offs

- **[Risk]** The dropped-connection test asserts an *absence* (no crash,
  no further events) rather than a positive recovery — this is
  correctly weaker evidence than a reconnect test would be, and is
  exactly why it's flagged as documenting current behavior rather than
  validating a feature.
- **[Risk]** The fake runner's kind-aware branching is itself new test
  infrastructure (not a straight port of `server.test.ts`'s fixed-script
  fake) — mitigated by keeping it in one shared helper file used by all
  three new specs, not duplicated three times.
- **[Risk]** Seeding the journal directly on disk (rather than driving a
  real extension run) means the recovery/rollback test proves the
  mechanism works, not that a real extension-produced checkpoint would
  look exactly like the hand-seeded one — acceptable, since
  `checkpoint.test.ts`/`workbench-recovery.test.ts` already cover the
  capture side at the unit level; this suite's job is the UI/REST path,
  not re-proving checkpoint capture itself.

**Separate finding, out of scope for this change:** writing the
"mutating run's events render in order" test first hit a real,
reproducible hang, not a test bug. `OpenSpecUiServer.close()`
(`packages/server/src/server.ts`) calls `wss.close(callback)`; the `ws`
library's own `close()` (confirmed by reading `node_modules/ws/lib/
websocket-server.js` directly) does not terminate connected clients —
when constructed with an external `server` (as this codebase always
does), it only sets an internal flag and waits for each client to
disconnect on its own before invoking the callback. A browser page that
leaves its WebSocket open (which `FetchTransport` always does — see
Non-Goals) therefore makes `close()` hang indefinitely. Node's
`server.closeAllConnections()` does **not** help here either — Node's
own documentation states it does not affect sockets already upgraded to
a different protocol such as WebSocket, and this was confirmed
empirically: a version of this test relying on it alone still hung for
the full test timeout. These tests work around it by severing the
client side of the connection first (`fixtures/intercept-websocket.ts`,
via `page.routeWebSocket`), which is a Playwright-only mechanism, not
something production code can use.

This means `packages/extension/src/optional-server.ts`'s
`OptionalServerManager.stop()` — which calls `await this.server.close()`
directly, with no timeout — can hang indefinitely today if a standalone
browser tab is still open against that server when a user stops it from
VS Code. This is a real, separate bug, unrelated to what this change is
testing (E2E coverage, not server shutdown behavior) and is not fixed
here — flagged for a possible separate follow-up change instead.
