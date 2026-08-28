## 1. Shared test fixtures

- [x] 1.1 Add `packages/server/e2e/fixtures/fake-agent-runner.ts`: a
  kind-aware `AgentRunner` factory keyed for registration under
  `"claude-cli"` (`DEFAULT_AGENT_ID`) — `list` yields one `stdout` event
  with `{ changes: [{ name }] }` JSON; `implement` yields
  `started`→`progress`→`stdout`→`completed`, with the `completed` event
  gated behind a caller-supplied `Promise` so tests can inspect mid-run
  state before letting it finish.
- [x] 1.2 Add `packages/server/e2e/fixtures/seed-interrupted-run.ts`:
  given a workspace root and a change name, writes real files, captures
  a checkpoint (`captureCheckpoint`), mutates the files, and writes a
  `WorkbenchRunJournal` with one `state: "running"` process and its
  unfinalized checkpoint session (deliberately *not* pre-finalized — see
  design.md: `WorkbenchRecoveryService.open()`'s own constructor/
  `initialize()` flips it to `interrupted` and computes the real delta
  against current disk state, exercising the actual recovery pipeline
  rather than one this fixture finalized ahead of time).
- [x] 1.3 Add `packages/server/e2e/fixtures/create-lifecycle-workspace.ts`
  (factored out of `standalone.spec.ts`'s existing fixture pattern) and
  `packages/server/e2e/fixtures/ai-panel-actions.ts`'s
  `loadAndSelectChange` — shared by all three new specs, not duplicated.
- [x] 1.4 Add `packages/server/e2e/fixtures/intercept-websocket.ts`
  (found necessary mid-implementation — see design.md Risks):
  `page.routeWebSocket` passthrough that keeps a handle to close the
  client side of the connection deterministically, since neither a plain
  `server.close()` nor `httpServer.closeAllConnections()` actually
  severs an already-open browser WebSocket.

## 2. `lifecycle-execution.spec.ts`

- [x] 2.1 "A mutating run's events render in the order they occurred":
  load a change via the AI panel, select `implement`, run it against the
  gated fake runner, assert the event log's rendered order (by DOM
  `className`) matches the runner's yield order, ending in a `completed`
  entry.
- [x] 2.2 "A dropped connection during a run does not crash the page":
  start an `implement` run, sever the WebSocket mid-run via
  `interceptWebSocket`, assert no `pageerror` fired and the event count/
  status stay at their last-received state.
- [x] 2.3 "A server stopped mid-run has no record of that run on
  restart": start an `implement` run from the browser, sever the client
  connection and close the server before the gated `completed` event
  fires, start a new `createServer()` against the same real workspace
  root, reload the page, open Processes and Recovery, and assert no row
  exists for that run.

## 3. `lifecycle-recovery-and-rollback.spec.ts`

- [x] 3.1 Seed an interrupted run (task 1.2) before starting the server.
  Open Processes and Recovery, click Review on that row, and assert the
  interrupted state and the changed file are shown (the real recovery
  pipeline finalizes the delta on server startup, not the fixture).
- [x] 3.2 Click Rollback files; assert the `role="status"` message
  reports files restored, and that the file's real on-disk content is
  back to its pre-checkpoint state.

## 4. `lifecycle-concurrent-hosts.spec.ts`

- [x] 4.1 Start two `createServer()` instances (two ports) against the
  same real temp workspace root, each with its own gated fake runner and
  its own `browser.newContext()` page.
- [x] 4.2 From the first page, start `implement` and wait for its
  `started` event (lease acquired). From the second page, start
  `implement` against the same change and assert its AI panel shows a
  failed run whose reason names the first host (`"standalone server"`).
  Release the first run's gate and confirm the second page can then run
  successfully afterward.

## 5. Verification

- [x] 5.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [x] 5.2 `npm run test:browser --workspace @openspec-ui/server` passes
  (6/6, including the existing `standalone.spec.ts`), run twice to rule
  out flakiness in the new specs.
- [x] 5.3 Run `openspec change validate --strict standalone-lifecycle-e2e`.

## 6. Findings recorded, not fixed, in this change

- `OpenSpecUiServer.close()` (`packages/server/src/server.ts`) hangs
  indefinitely if any client's WebSocket is still open — `wss.close()`
  (the `ws` library) only waits for clients to disconnect on their own
  when constructed against an external `server`; it never terminates
  them. `httpServer.closeAllConnections()` does not help (Node
  documents it as not affecting already-upgraded sockets, confirmed
  empirically here). This is a real, separate latent bug reachable
  through `packages/extension/src/optional-server.ts`'s
  `OptionalServerManager.stop()` (a user stopping the optional server
  from VS Code while a standalone browser tab is still open would hang
  that command indefinitely) — flagged for a possible follow-up change,
  not fixed here since it's outside this change's E2E-coverage scope.
