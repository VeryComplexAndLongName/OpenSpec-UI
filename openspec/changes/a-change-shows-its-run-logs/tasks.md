Asked by the owner on 2026-09-21: how to see a change's logs, and a button
on the change that opens them.

## 1. Runs keep logs

- [x] 1.1 `run-log.ts` in core: `createFileRunLogs` writes
  `.openspec-ui/runs/<runId>.jsonl` (start, lines, end), buffered, capped at
  5 MB with a note where it stopped, the newest 200 kept, never failing a
  run. `runLogLineOf` reads an event as every surface does.
- [x] 1.2 `AgentRunner.run()` writes the log for every run, a refused one
  included; `runLogs` is threaded through `buildDefaultAgentRunners`.
- [x] 1.3 The extension, its built-in server, the standalone server and the
  CLI hand their runners the workspace's logs.

## 2. Logs are read

- [x] 2.1 `listRunLogs` (newest first, one change's where named, from each
  log's first and last lines) and `readRunLog`; a run id that could name a
  path is refused. The types live in `run-log-facts.ts` for the browser.
- [x] 2.2 The standalone server: `POST /api/run-logs/list` and
  `POST /api/run-logs/read`.
- [x] 2.3 The Pipeline panel: `pipeline/run-logs` and `pipeline/run-log`
  over the bridge, from its own root.

## 3. A button on the change

- [x] 3.1 Logs on every card of the Pipeline, when the host can show them.
- [x] 3.2 `RunLogsView`: the change's runs and the chosen one's log,
  beneath the picture, in the standalone and in the editor's panel.

## 4. Checks

- [x] 4.1 Tests: core, 9 in `run-log.test.ts` (the log, a chain's two
  parts, the cap, the count, the list for one change, a path refused, the
  reading of an event, a runner's run and a refused one); the server's two
  endpoints, 2; the panel's two operations, 1; the card's button, 2; the
  view, 4.
- [x] 4.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped. typecheck and lint pass. Tests: cli 175,
  core 1760 and 31, extension 483, server 114, webui 645 of 646. The one
  failure is `packages/webui/scripts/build-metro-icons.test.mjs`, which
  fails on Windows for its line endings and fails the same way on untouched
  `main`.
- [x] 4.3 The whole standalone browser suite passes: 28 of 28, with
  `run-logs.spec.ts`, which opens a change's two runs from its card, shows
  the newest, then the older one, and closes.
- [x] 4.4 The extension's integration suite passes: 18 passing.
- [x] 4.5 A changeset: every package, minor.
- [x] 4.6 `openspec validate a-change-shows-its-run-logs --strict`.
- [x] 4.7 **Human-only.** A real run in the owner's workspace leaves a log,
  and the card's Logs shows what it said. **Deferred:** it needs a build of
  the product that writes logs, which the owner's editor and standalone
  get from the release that carries this change. Moved to
  `openspec/deferred.md`.
