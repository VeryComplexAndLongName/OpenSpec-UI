# Change: Standalone Lifecycle E2E

## Why

`packages/server/e2e/standalone.spec.ts` (the only browser E2E suite,
gated by `.github/workflows/quality.yml`'s `browser-e2e` job) has exactly
one test, covering load/edit/save and accessibility. Nothing exercises a
real agent run through a real browser: no mutating-run event lifecycle,
no interrupted-run recovery, no rollback, no cross-host contention —
despite core owning real, tested behavior for all of these
(`process-scheduler.ts`, `workbench-recovery.ts`, `checkpoint.ts`, the
cross-host lease from `openspec/changes/archive/
2026-08-28-cross-host-workspace-lease/`). None of it has ever been
proven to work through the actual React UI in a real browser — only at
the unit/vitest-integration layer.

Research before writing any test (see design.md Context) found that two
of the five originally-discussed scenarios don't correspond to real
production behavior:

- **WebSocket reconnect** does not exist. `FetchTransport`
  (`packages/webui/src/transport/fetch-transport.ts`) has no `close`/
  `error` listener on its WebSocket, no backoff, no resumption. A
  dropped connection silently stops delivering events; nothing
  reconnects. A test can only prove the current (negative) behavior:
  the page does not crash, no further events arrive, nothing resumes.
- **"Host stopped during a run"**, for the real WebSocket `implement`
  path specifically, has nothing to recover: `WorkbenchRecoveryService
  .runMutating()` (`packages/core/src/workbench-recovery.ts`) only calls
  `persist()` after the run's `execute` callback finishes — a server
  killed mid-run never wrote that run to the journal at all. This is
  the same limitation `docs/adr/0010-cross-host-workspace-lease.md` and
  its design.md already disclosed (no checkpoint capture, no crash
  recovery, for this path). A test of a real kill-mid-run therefore
  proves the gap, not a recovery; the actual interrupted-recovery
  mechanism (which is real, and already unit-tested) needs to be
  exercised through a seeded journal instead — the same fixture pattern
  `packages/server/src/server.test.ts` already uses.

Both are still worth testing — for what they actually do today, not for
what the original scenario names implied.

Separately, "concurrent standalone and extension" cannot be built as
literally named: Playwright drives a browser page, not a VS Code
window. The real, Playwright-buildable equivalent is two standalone
server processes against the same real workspace, each with its own
browser page — the same cross-host lease
`docs/adr/0010-cross-host-workspace-lease.md` added, now proven through
the actual UI rather than a raw WebSocket client in a vitest test.

## What Changes

- Add `packages/server/e2e/lifecycle-execution.spec.ts`:
  - A real `implement` run, started from the AI panel through a fake
    `claude-cli` runner (registered in the test's own `createServer({
    runners })`, matching `DEFAULT_AGENT_ID` so the panel's default
    agent selection needs no interaction — the same "substitute a fake
    AgentRunner, no real CLI agent" approach `server.test.ts` already
    uses), asserting every event renders in the event log in the exact
    order the runner yielded them.
  - A dropped-connection test: close the underlying WebSocket mid-run
    (via routing/blocking, not a UI action) and assert the page reports
    no uncaught error and simply stops receiving events — documenting
    current behavior, not a reconnect that doesn't exist.
  - A real host-stopped-mid-run test: start an `implement` run from the
    browser, close that server process before it completes, start a new
    server against the same real workspace root, reload the browser, and
    confirm the Processes list has no record of that run at all —
    documenting the real, current gap rather than asserting a recovery
    that cannot happen on this path yet.
- Add `packages/server/e2e/lifecycle-recovery-and-rollback.spec.ts`:
  seed a real journal + checkpoint on disk (processes + checkpointSessions,
  written directly to `.openspec-ui/workbench-runs.json` before the
  server ever opens that root — the same fixture pattern
  `server.test.ts` already uses for rollback tests) representing an
  interrupted run with a finalized checkpoint delta. Start the server,
  open the Processes and Recovery tab, confirm the interrupted state and
  delta are shown, click Rollback, and confirm both the UI message and
  the actual file content on disk.
- Add `packages/server/e2e/lifecycle-concurrent-hosts.spec.ts`: two real
  `createServer()` processes (two ports) against the same real temp
  workspace, one browser page per server. One page starts `implement`
  (acquiring the lease); the other page's `implement` attempt is shown
  as failed, naming the first host, through the actual AI panel UI —
  not a raw WebSocket assertion.

## Capabilities

### Modified Capabilities

- `quality-gates`: extends "Standalone browser journeys are release-gated"
  with mutating-run lifecycle, dropped-connection, crash-recovery, and
  cross-host scenarios beyond the existing load/edit/save/accessibility
  coverage.

## Impact

- `packages/server/e2e/lifecycle-execution.spec.ts` (new)
- `packages/server/e2e/lifecycle-recovery-and-rollback.spec.ts` (new)
- `packages/server/e2e/lifecycle-concurrent-hosts.spec.ts` (new)
