Start, answer and stop on the card, for the runs a host started, with a
stop that waits for a sound point (ADR 0029, ADR 0028).

## 1. The protocol

- [x] 1.1 `CommandKind` and `COMMAND_KINDS` in `packages/core/src/protocol.ts`
  gain `"stop"`. The documentation of `Command.reason` says that a `stop`
  carries the reason a person gave.

  Done. `commandInstruction` in `agents/shared.ts` has an exhaustive
  switch, so it lists `stop` with the kinds that never reach a CLI agent.
  `protocol.test.ts` checks that `COMMAND_KINDS` contains `stop`.
- [x] 1.2 `StopRequestedEvent { kind: "stopRequested"; reason: string; by?: string; outcome: "asked" | "nothing-to-stop" }`
  joins `Event`. `isEvent` accepts it only when `reason` is a string and
  `outcome` is one of the two values.

  Done. `isEvent` also refuses a `by` that is present but not a string.
  `protocol.test.ts` has `stopRequested` in its sample for every kind,
  which a missing kind fails to compile, and a round trip for each
  outcome. One further test refuses a missing or non-string reason, an
  unknown or missing outcome, and a non-string `by`. The file passes, 32
  tests.
- [x] 1.3 The contract test for "every defined event kind survives a
  transport" covers `stopRequested` over the server's WebSocket and over the
  extension's bridge. A `stop` command survives both transports too.

  Done:
  - Server: `ALL_EVENT_VARIANTS`, which "streams every event variant back
    over the same connection, in order" sends, now includes a
    `stopRequested`. A new test sends a `stop` command with a reason over
    the WebSocket; the resolved runner receives it whole, and its
    `stopRequested` comes back.
  - Bridge: `message-bridge-transport.test.ts` delivers `stopRequested`
    with each outcome to the webview, and posts a `stop` command whole,
    reason included.
  - The three exhaustive event switches say what a stop request is:
    `describe-event.ts` in the extension (tested with each outcome), the
    AI panel's in the webui, and the extension AI panel's list of
    non-terminal kinds.

  Webui, extension and server typecheck. The touched tests pass: server
  3 selected, webui bridge and AiPanel 66, extension `describe-event`.
- [ ] 1.4 `AuditEntry` in `packages/core/src/security.ts` gains
  `stopRequest?: { reason: string; by?: string }`. It is written only on a
  chain ending entry, after a requested stop.

## 2. The registry

- [ ] 2.1 A new `packages/core/src/live-runs.ts` exports `LiveRuns`, which
  does no IO:
  - `track(command: Command, events: AsyncIterable<Event>): AsyncIterable<Event>`
    yields every event unchanged. From those events it holds
    `{ runId, changeName, kind, startedAt, waiting, stopRequested }` until a
    terminal event removes the run.
  - `get(runId)`
  - `list()`
- [ ] 2.2 core `live-runs.test.ts` follows one run through its events:
  - it appears when it starts;
  - it is waiting after `checkpoint`, and no longer waiting after the next
    `stageStarted`;
  - it holds a stop after `stopRequested`;
  - it is gone after `cancelled`.

  Events pass through unchanged and in order.
- [ ] 2.3 Server:
  - `packages/server/src/websocket.ts` tracks every chain and agent run it
    starts through a single `LiveRuns` for the server process.
  - `server.ts` routes `POST /api/live-runs` to `handleLiveRunsRequest` in
    `rest.ts`, which answers `list()` for an authorized `cwd`, filtered to
    that `cwd`.
  - The delegated item route in `server.ts` tracks its runs through the same
    `LiveRuns`.
- [ ] 2.4 Extension:
  - `packages/extension/src/extension.ts` holds a single `LiveRuns`.
  - `RunController.run`, the chain start in `ai-panel.ts`, and the inbox's
    delegated item run all track their runs through it.
  - The pipeline panel answers `pipeline/live-runs` with `list()`.
- [ ] 2.5 Check each junction below, and record it: while running, each run
  appears in its host's `list()`.
  - a chain started from the Change Editor;
  - a chain started from the editor's AI panel;
  - a single-stage run from each host's AI panel;
  - a delegated item's run from each host.

## 3. Stopping where the work is sound

- [ ] 3.1 `HarnessChainRunner.requestStop(runId: string, reason: string, by?: string): boolean`
  in `packages/core/src/harness-chain-runner.ts` returns `false` for a run
  it does not have. For a run waiting at a checkpoint, it yields
  `stopRequested` with outcome `asked`, then ends the chain `cancelled` with
  no reason, as a declined checkpoint does.
- [ ] 3.2 For a run inside a stage, `requestStop` yields `stopRequested` with
  outcome `asked`, then ends the stage at the first of:
  - a completed reply or stdout line that `readTaskMarker` reads as a task
    other than the last one named;
  - `countTasks` for the change's task list rising above its value when the
    stop was asked, checked every 2 seconds and only while the stop is
    pending;
  - the stage's own end.

  It then cancels the stage's runner, starts no further stage, and ends
  `cancelled` with no reason.
- [ ] 3.3 A run waiting on a permission stops at once: the request is
  answered `deny`, and the chain ends as in 3.1.
- [ ] 3.4 `asAgentRunner()` turns a `stop` command into `requestStop` and
  yields the `stopRequested` it produces. For a run it does not have, it
  yields `stopRequested` with `outcome: "nothing-to-stop"`.
- [ ] 3.5 `AgentRunner` in `packages/core/src/agent-runner.ts` accepts `stop`
  for a single-stage run it holds, and ends the run at a marker naming
  another task, or when the count of ticked tasks rises, as in 3.2. For a
  `plan` or `review` run, it yields `stopRequested` and lets the run end on
  its own.
- [ ] 3.6 After a requested stop, the chain's ending entry carries
  `stopRequest { reason, by }` and no `reason`.
- [ ] 3.7 `by` is `GitWrapper.configuredIdentity()` for the host's
  workspace. It is absent when no identity is configured.
- [ ] 3.8 The status record:
  - `AgentStatusDocument` gains
    `stopRequested: { reason: string; by?: string; at: string } | null`.
  - `applyEventToAgentStatus` sets it on a `stopRequested` event with
    outcome `asked`, and writes at once. The activity becomes
    `asked to stop`, followed by `by <by>` where known and `: <reason>`.
  - `readAgentStatusRecord` reads a missing or malformed value as `null`.
- [ ] 3.9 core `harness-chain-runner.test.ts`:
  - a stop at a checkpoint ends the chain at once;
  - a stop during a stage ends it at the next marker naming another task;
  - when no marker comes, it ends at the next tick (a fake clock drives the
    2-second check);
  - when neither comes, it ends with the stage;
  - no stage starts after a stop;
  - the ending entry carries `stopRequest`;
  - an unknown run yields `nothing-to-stop`.
- [ ] 3.10 core `agent-runner.test.ts`: a single `implement` run stops at a
  tick; a `review` run accepts a stop and ends on its own.

## 4. The same feedback in both hosts

- [ ] 4.1 `websocket.ts` handles both a chain `cancel` and `stop` through
  `chainRunner.asAgentRunner()`, so the socket receives `cancelling` or
  `stopRequested`. Both events go to the socket that sent the command. Cover
  this in the server's websocket tests.
- [ ] 4.2 `trackHarnessProcess` in `packages/extension/src/webview/ai-panel.ts`
  gives a chain's scheduler entry the chain's `runId`. Cancelling that entry
  from the Processes tree calls `HarnessChainRunner.cancel` for the chain.
  Cover this in the extension's tests.

## 5. The card's controls

- [ ] 5.1 `describeChangeCards` in `packages/core/src/change-card.ts` takes
  `liveRunIds` and marks a live run whose `runId` is among them as
  `ownedHere`. For such a waiting run, `describeChangeCard` says
  `Waiting for you` instead of `Waiting`. Do not compute this in the view.
- [ ] 5.2 Start is offered when the card's state is `ready`, `failed` or
  `stopped`.
  - Standalone: it opens `RunDialog` for that change in a
    `role="dialog"` layer over the Pipeline tab. Focus moves into the
    dialog, and returns to Start when it closes. A chosen chain path shows
    `HarnessChainPanel` inside the dialog.
  - Editor: it posts `openspec-ui/run-change`. The pipeline panel checks the
    name as it does for `openspec-ui/open-change`, then runs
    `openspec-ui.runWithHarness` for that change.
- [ ] 5.3 `openspec-ui.runWithHarness` in `packages/extension/src/commands.ts`
  accepts a change name as well as a tree item. It refuses a name that is
  not an active change of the workspace, and says so.
- [ ] 5.4 Answer, on a card whose run is `ownedHere`:
  - at a checkpoint, `Continue to <nextStage>` sends `confirmCheckpoint`,
    and `Stop` opens the reason form and sends `stop`;
  - on a permission, `Allow` and `Deny` send the existing permission answer,
    beside the permission's description.
- [ ] 5.5 Stop, on a card whose run is `ownedHere` and has no stop asked: the
  `Stop` button opens a form with one required reason field and an
  `Ask to stop` button, which sends `stop`. The card then states the
  request from the record: `asked to stop: <reason>`.
- [ ] 5.6 Stop now, on a card whose run is `ownedHere` and has a stop asked:
  the `Stop now` button sends `cancel`.
- [ ] 5.7 A card whose run is not `ownedHere` offers no Answer, Stop or Stop
  now. A waiting run's line says it is answered where it was started. The
  card shows the run's working directory with a `Copy folder path` button,
  and offers nothing that opens the folder.
- [ ] 5.8 Every control is a button, and its accessible name includes the
  change's name.
- [ ] 5.9 webui `PipelineView.test.tsx`:
  - for a run that is `ownedHere`, the right controls appear and send the
    right command: at a checkpoint, on a permission, and while running both
    with and without a stop asked;
  - for a run that is not `ownedHere`, no controls appear, and copying the
    path copies the working directory;
  - Start opens the dialog for its change;
  - the reason form refuses an empty reason.

## 6. Browser suite

- [ ] 6.1 browser `e2e/pipeline.spec.ts`, with a stand-in agent:
  1. start a chain from a card;
  2. answer its checkpoint on the card;
  3. ask it to stop, with a reason;
  4. confirm the card says the run was asked to stop.

  The tab passes axe at WCAG AA while the reason form is open.

## 7. Verification

- [ ] 7.1 This change validates strictly. `check(validate-change)`
- [ ] 7.2 `npm run verify` unpiped, after the last edit and with everything
  staged. Record the run and the test count for each package.
- [ ] 7.3 A pending changeset exists: core, server, extension and webui are
  each minor. `check(changeset-present)`
- [ ] 7.4 Run the whole browser suite, not a selected spec.
- [ ] 7.5 **Delegated to claude-cli**: a live stop in the standalone server.

  Setup:
  - the standalone server, built from this branch;
  - a scratch repository;
  - a stand-in `claude` that, for the stage that implements, prints
    `Starting task 1.1`, waits 15 seconds, ticks 1.1, prints
    `Starting task 1.2`, and waits 60 seconds.

  Steps:
  1. Start the chain from its card.
  2. Continue at the checkpoint, on the card.
  3. While 1.1 runs, press Stop with the reason `live check`.
  4. Record when the chain ends.

  Evidence:
  - the WebSocket events from `stopRequested` through `cancelled`, with
    timestamps;
  - that `cancelled` came after the `Starting task 1.2` line and before the
    stand-in's 60 seconds ran out;
  - the chain ending entry, with `stopRequest`;
  - the card's text while the stop was pending.
- [ ] 7.6 **Delegated to claude-cli**: the same stop in the editor.

  In an Extension Development Host built from this branch:
  1. Ask for the stop from the pipeline panel.
  2. Use "Cancel Process" on a running chain in the Processes tree.

  Evidence: the extension host's log lines for `stopRequested` and
  `cancelled`, and the audit entries of both runs.
