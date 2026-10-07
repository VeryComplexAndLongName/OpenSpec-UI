Found on 2026-10-07 while checking the-board-and-the-run-read-right.

## 1. Server

- [x] 1.1 `websocket.ts`: a `resolvePermission` naming no agent goes to the
  runner that holds the run, as `cancel` and `stop` do. Test in
  `server.test.ts`: a run on a non-default agent asks, the answer naming no
  agent reaches it, the default runner receives nothing; failing before
  the fix.
  The test timed out before the fix and passes with it.

## 2. Web UI

- [x] 2.1 `AiPanel.tsx`: one subscription per transport, `onRunTerminal`
  read through a ref. Test in `AiPanel.test.tsx`: a render with a new
  `onRunTerminal` does not subscribe again, and the latest one is called.
- [x] 2.2 `fetch-transport.ts`: the socket closes only when nobody has
  subscribed again by the next task. Tests in `fetch-transport.test.ts`:
  it still closes when nobody subscribes again; an unsubscribe followed by
  a subscribe keeps it, and the run's events reach the new subscriber.

- [x] 2.3 `documentation-screenshots.spec.ts` closes the page's socket
  before `server.close()`, as the other specs that run a command do: it
  passed only because the panel closed the socket by accident, and timed
  out at 120 s with the fix.

## 3. Documents

- [x] 3.1 A changeset: server, webui, patch.
  `.changeset/the-standalone-panel-follows-its-run.md`.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`, and the server's and the web
  UI's tests.
  Typecheck clean; lint 0 errors (3 warnings in lines this change did not
  touch); seven script tests and the English check pass. Server 123, webui
  716, extension 508 passed. Browser tests: the four that failed in a run
  on a loaded machine were run again on their own; three passed as they
  were, and `documentation-screenshots` passed after 2.3.
- [x] 4.2 `openspec validate the-standalone-panel-follows-its-run
  --strict`, and the merge gate with the worktree's absolute path as
  `--cwd`.
  Valid; the gate reports nothing open.
- [x] 4.3 One live run: in the standalone app, a run on `copilot-cli-acp`
  that asks for permissions, each answered with **Allow** in the AI panel,
  is shown to its end.
  2026-10-07, with these fixes applied to the branches of
  the-board-and-the-run-read-right and the-plan-is-updated-from-its-review
  in turn: a `plan` that asked three times and an `update` that asked six
  times, each answered with **Allow** in the AI panel, were shown to
  Completed, and the socket was never closed during them. Before any fix,
  the same `plan` waited for ever after its first **Allow**, and its run
  log showed no answer reaching the agent. With the server's fix alone,
  the agent went on to its next request, by its run log, while the panel
  showed nothing more: the page's socket had been closed by the panel's
  re-subscription.
