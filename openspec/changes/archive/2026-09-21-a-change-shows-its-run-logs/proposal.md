## Why

On 2026-09-21 the owner asked how to see a change's logs ("it is needed very
often"), and for a button on the change that opens them.

There was nothing to open. A run's output travelled live, to the socket or
the panel that started it, and was gone once the run ended or the host
restarted. What survived was a summary or a reason in
`workbench-runs.json` and `audit.jsonl`. Checked the same day:

- nothing in core, the server or the extension writes a run's output to
  disk;
- no endpoint or webview message returns a past run's events;
- the Processes views show a summary and an error, and nothing a run said.

## What Changes

- **Every run keeps a log.** `AgentRunner.run()` writes
  `.openspec-ui/runs/<runId>.jsonl`. Every run of every host passes through
  that one method. The file holds:
  - a `start` record per stage: a chain's stages share one run id and each
    opens its own part;
  - a `line` for what the run said, read as every surface reads it:
    stdout and stderr, an agent's reply or reasoning, a tool call as the
    line core makes of it, a stage, a stop, a permission asked;
  - an `end` with the outcome, reason and summary.

  A run the sandbox or the allowlist refused gets a log too, which says
  why.
- **Bounded.** A log stops at 5 MB and says where it stopped; its end is
  still written. The directory keeps the newest 200 logs. Writing never
  holds up a run or fails one.
- **Only hosts write.** A runner writes logs when its host hands it the
  workspace's logs: the extension, its built-in server, the standalone
  server and the CLI. A runner built in a test writes nothing.
- **Read the same way everywhere.** Core lists a workspace's runs, one
  change's where asked, newest first, from each log's first and last
  lines, and reads one run's log. The standalone asks
  `/api/run-logs/list` and `/api/run-logs/read`. The editor's Pipeline
  panel asks `pipeline/run-logs` and `pipeline/run-log` over its bridge.
  A run id that could name anything outside the directory is refused.
- **A Logs button on every card.** Both Pipelines, the standalone's and
  the editor's panel, offer Logs on each change's card. It opens the
  change's runs beneath the picture, and the newest run's log with it:
  - one row per run: when it started, what it was, the agent, and how it
    ended;
  - the log with each stage as a heading, the chunks of one stream joined,
    stderr and failures marked, and tool calls and reasoning set apart.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - runs keep logs, and core reads them.
- `standalone-app` - the endpoints, and Logs on a card.
- `vscode-extension` - Logs on a card in the Pipeline panel.

## Impact

- New in core: `run-log.ts` (writing, listing and reading) and
  `run-log-facts.ts` (the types, for the browser). `agent-runner.ts` and
  `default-runners.ts` take `runLogs`.
- The hosts hand their logs over: `extension.ts`, `optional-server.ts`,
  `server/src/cli.ts`, `cli/src/run-change.ts`.
- `server/src/rest.ts` and `server.ts` (two endpoints),
  `extension/src/webview/pipeline-panel.ts` (two bridge operations).
- New in webui: `RunLogsView.tsx` and `run-logs-client.ts`. Changed:
  `PipelineView.tsx` (Logs), `standalone-entry.tsx`, `pipeline-entry.tsx`,
  `bridge-request.ts`, `icons.ts`, `shell-ui.ts`.
- `README.md`.
- A changeset: every package changes.

## Explicitly out of scope

- **Runs from before this.** They kept no output; their logs say so by
  not being there.
- **Following a live run in the log.** The log shows what was written when
  it was opened; the card and the panel that started a run already show it
  live.
- **A log per working directory.** A run is logged under the host's
  workspace, wherever it works.
- **The Processes tab and tree.** They list processes by id; the card is
  where a person looks for a change.
