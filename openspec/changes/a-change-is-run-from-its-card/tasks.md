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

- [x] 2.1 A new `packages/core/src/live-runs.ts` exports `LiveRuns`, which
  does no IO:
  - `track(command: Command, events: AsyncIterable<Event>): AsyncIterable<Event>`
    yields every event unchanged. From those events it holds
    `{ runId, changeName, kind, startedAt, waiting, stopRequested }` until a
    terminal event removes the run.
  - `get(runId)`
  - `list()`

  Done: `LiveRun` holds `changeName` (the change directory's name, or
  `null`), `waiting: boolean` and `stopRequested` (`null` until asked).
  - Only commands that start work are tracked: `plan`, `implement`,
    `review`, `verify` and `chain`. A `cancel`, `confirmCheckpoint`,
    `resolvePermission` or `stop` passes through untracked.
  - A chain forwards a stage's `failed` or `cancelled` that another
    attempt follows. A terminal event therefore removes the run, a later
    event holds it again with its first start time, and the end of its
    events releases it for good.
  - `get` and `list` return copies.
  - `browser.ts` exports the `LiveRun` type; `index.ts` exports the class.
- [x] 2.2 core `live-runs.test.ts` follows one run through its events:
  - it appears when it starts;
  - it is waiting after `checkpoint`, and no longer waiting after the next
    `stageStarted`;
  - it holds a stop after `stopRequested`;
  - it is gone after `cancelled`.

  Events pass through unchanged and in order.

  Done: the first test walks exactly that sequence, and checks every
  event passed through unchanged and in order. Six more tests cover:
  - a stage that failed and was attempted again, held again with its
    first start time;
  - a stop that found nothing to stop, which holds no stop;
  - a wait on a permission, which a usage report does not clear;
  - a control command, which is not tracked;
  - an abandoned iteration, which releases the run;
  - `list()`, which returns copies.

  The file passes, 7 tests, and core typechecks.
- [x] 2.3 Server:
  - `packages/server/src/websocket.ts` tracks every chain and agent run it
    starts through a single `LiveRuns` for the server process.
  - `server.ts` routes `POST /api/live-runs` to `handleLiveRunsRequest` in
    `rest.ts`, which answers `list()` for an authorized `cwd`, filtered to
    that `cwd`.
  - The delegated item route in `server.ts` tracks its runs through the same
    `LiveRuns`.

  Done:
  - `createServer` holds one `LiveRuns` beside its one `HarnessChainRunner`.
    `handleSocketMessage` takes it: a chain's events pass through
    `liveRuns.track` in `streamChainEvents`, and a single-stage command runs
    on `liveRuns.runner(runner)`. `LiveRun` gained `cwd` for the filter, and
    core gained `LiveRuns.runner`, with a test.
  - `handleLiveRunsRequest` answers `{ runs }` with the held runs whose
    resolved `cwd` is the request's, after the same body check and
    `authorizeCwd` as the other workspace routes.
  - `handleDelegatedItemRunRequest` takes the registry and hands
    `runDelegatedItem` the resolved runner wrapped the same way.

  `server.test.ts` has two new tests:
  - A `review` run over the socket, held by a gate. It is listed for its
    workspace while it runs, not for another workspace, and gone once
    `completed` arrives.
  - A request with no cwd gets 400, and one outside the workspace 403.

  Six selected server tests pass, and server typecheck and lint are
  clean. The delegated route is checked end to end in 2.5.
- [x] 2.4 Extension:
  - `packages/extension/src/extension.ts` holds a single `LiveRuns`.
  - `RunController.run`, the chain start in `ai-panel.ts`, and the inbox's
    delegated item run all track their runs through it.
  - The pipeline panel answers `pipeline/live-runs` with `list()`.

  Done:
  - `activate` makes one `LiveRuns` and gives it to `RunController`.
  - `RunController.run` passes a runner's events through `liveRuns.track`.
    That covers the palette, a single stage from the AI panel, and the AI
    panel's chain, which starts through `runController.run(chainRunner.asAgentRunner(), command)`.
  - The inbox's delegated item hands `runDelegatedItem` a runner wrapped
    with `liveRuns.runner`.
  - `PipelinePanel` takes the registry and answers `pipeline/live-runs`
    with `{ runs }` for its own root. The server's route has the same
    shape. Without a registry it answers no runs. `BridgeOperation` gains
    the op.

  Tests:
  - `run-controller.test.ts`: a run is held while it goes on, and released
    once it completes.
  - `pipeline-panel.test.ts`: only the root's runs are answered, whatever
    the message names, and none without a registry.

  The two files pass, 8 and 16 tests. Extension and webui typecheck, and
  lint is clean.
- [ ] 2.5 Check each junction below, and record it: while running, each run
  appears in its host's `list()`.
  - a chain started from the Change Editor;
  - a chain started from the editor's AI panel;
  - a single-stage run from each host's AI panel;
  - a delegated item's run from each host.

## 3. Stopping where the work is sound

- [x] 3.1 `HarnessChainRunner.requestStop(runId: string, reason: string, by?: string): boolean`
  in `packages/core/src/harness-chain-runner.ts` returns `false` for a run
  it does not have. For a run waiting at a checkpoint, it yields
  `stopRequested` with outcome `asked`, then ends the chain `cancelled` with
  no reason, as a declined checkpoint does.

  Done: the checkpoint resolves `stopped`, and the chain yields
  `stopRequested` and then `cancelled` with no reason. A stop asked for
  between stages ends the chain the same way before another stage starts.
  A second request while one is pending changes nothing.
- [x] 3.2 For a run inside a stage, `requestStop` yields `stopRequested` with
  outcome `asked`, then ends the stage at the first of:
  - a completed reply or stdout line that `readTaskMarker` reads as a task
    other than the last one named;
  - `countTasks` for the change's task list rising above its value when the
    stop was asked, checked every 2 seconds and only while the stop is
    pending;
  - the stage's own end.

  It then cancels the stage's runner, starts no further stage, and ends
  `cancelled` with no reason.

  Done: `runStage` no longer reads the runner with `for await`. It races
  the next event against a wake that `requestStop` gives, and, once the
  stop is announced, against a 2-second interval that only runs then.
  - A marker is read from stdout lines and from an ACP agent's streamed
    text. A line counts once its newline arrives, or once a different kind
    of event does.
  - The ticked count is taken as the stop is announced and read on each
    wake.
  - The stage ends through the runner's own `cancel`, so its `cancelled`
    comes once the process is gone, with no reason, and is not taken for
    a ceiling to retry.
  - A stage that ends on its own first ends the chain before another stage
    starts.
- [x] 3.3 A run waiting on a permission stops at once: the request is
  answered `deny`, and the chain ends as in 3.1.

  Done: the stage remembers the permission request it waits on until any
  other output arrives. A stop sends `resolvePermission` with `deny` for
  it and cancels the stage. A permission asked for after the stop is
  announced is denied the same way.
- [x] 3.4 `asAgentRunner()` turns a `stop` command into `requestStop` and
  yields the `stopRequested` it produces. For a run it does not have, it
  yields `stopRequested` with `outcome: "nothing-to-stop"`.

  Done, with one deliberate difference. For a run this runner has, the
  `stopRequested` is yielded once, on the chain's own stream. That is the
  stream the status record, the live-runs registry and the host that sent
  the command already read. Yielding it on the stop command's stream too
  would reach the same socket or panel twice. A stop for a run it does not
  have is answered on the stop command's stream with `nothing-to-stop`.
- [x] 3.5 `AgentRunner` in `packages/core/src/agent-runner.ts` accepts `stop`
  for a single-stage run it holds, and ends the run at a marker naming
  another task, or when the count of ticked tasks rises, as in 3.2. For a
  `plan` or `review` run, it yields `stopRequested` and lets the run end on
  its own.

  Done, and the chain's stop now uses the same rule. Where a stop may end
  a run is in one new module, `packages/core/src/stop-boundary.ts`.
  `HarnessChainRunner`'s stage loop and `createAgentRunner` both pass
  their events through its `untilStopBoundary`, so the two runners cannot
  drift into two answers.
  - `untilStopBoundary` holds the race against a wake, the 2-second check
    while a stop is pending, and marker reading through
    `TaskMarkerReader`. It also denies a pending permission.
  - Moving the marker reading there fixed one thing the chain's first
    version did: it read markers from an ACP agent's reasoning. The shared
    reader reads the reply only, as the status record already does.
  - In `createAgentRunner`, a held run keeps its kind, its stop and its
    wake. A `stop` for a held run records the stop and wakes the run,
    whose own stream announces it, with `by` from the configured git
    identity. A `stop` for a run it does not hold is answered
    `nothing-to-stop`.
  - `implement` and `verify` end at a boundary by aborting their signal,
    so `cancelled` has no reason. `plan` and `review` announce the stop
    and end on their own.
  - `AgentRunnerOptions.readIdentity` is the seam for `by`.
- [x] 3.6 After a requested stop, the chain's ending entry carries
  `stopRequest { reason, by }` and no `reason`.

  Done: `recordEnding` writes `stopRequest` on a `cancelled` ending after a
  requested stop, and leaves `reason` off it.
- [x] 3.7 `by` is `GitWrapper.configuredIdentity()` for the host's
  workspace. It is absent when no identity is configured.

  Done: where the caller gives no `by`, the announcement reads
  `configuredIdentity()` for the command's `cwd` through the runner's own
  `createGitWrapper` seam. An identity that is absent or cannot be read
  leaves `by` off; the stop still goes ahead.
- [x] 3.8 The status record:
  - `AgentStatusDocument` gains
    `stopRequested: { reason: string; by?: string; at: string } | null`.
  - `applyEventToAgentStatus` sets it on a `stopRequested` event with
    outcome `asked`, and writes at once. The activity becomes
    `asked to stop`, followed by `by <by>` where known and `: <reason>`.
  - `readAgentStatusRecord` reads a missing or malformed value as `null`.

  Done:
  - `AgentStatusStopRequest` is exported beside `AgentStatusWaiting`. The
    document and `AgentStatusReport` both carry `stopRequested`, and a
    record that does not check out carries `null`.
  - `AgentStatusWriter.reportStopRequested` sets the field and the
    activity, for example `asked to stop by ada@example.com: wrong branch`,
    and writes at once.
  - `applyEventToAgentStatus` handles the event before anything else, so a
    stop leaves a wait standing. A `nothing-to-stop` changes nothing.
  - `readStopRequested` reads a value that is missing or malformed as
    `null`.

  Tests in `agent-status.test.ts`:
  - an asked stop is on disk before the next event, and stays through
    later output;
  - `by` is left off where no one is named;
  - a `nothing-to-stop` leaves the record as it was;
  - the reads of an older record and a malformed one now also check
    `stopRequested: null`.

  `agent-status-sweep.test.ts` pins the document's fields, and now names
  `stopRequested` as present, not history. Three fixtures that build a
  report or document gained the field. The core files pass, 71 tests; cli
  `status-command` passes, 19. Core, cli, webui, extension and server
  typecheck.
- [x] 3.9 core `harness-chain-runner.test.ts`:
  - a stop at a checkpoint ends the chain at once;
  - a stop during a stage ends it at the next marker naming another task;
  - when no marker comes, it ends at the next tick (a fake clock drives the
    2-second check);
  - when neither comes, it ends with the stage;
  - no stage starts after a stop;
  - the ending entry carries `stopRequest`;
  - an unknown run yields `nothing-to-stop`.

  Done: "asked to stop" has seven tests. A scripted stage runner is fed
  one event at a time:
  - a marker, where the stage survives a line on the same task and ends
    at `Starting task 2.2`, no stage starts after, and the ending entry
    carries `stopRequest` with no `reason`;
  - a tick, under a fake `setInterval`: nothing happens at the first two
    seconds, and the stage ends at the next once a task is ticked;
  - the stage's own end;
  - a checkpoint, where `by` is left off when no identity is configured;
  - a permission, answered `deny`;
  - a stop sent through `asAgentRunner`, which arrives once, on the
    chain's stream;
  - an unknown run.

  The whole file passes, 102 tests; the 95 that were there before are
  unchanged.
- [x] 3.10 core `agent-runner.test.ts`: a single `implement` run stops at a
  tick; a `review` run accepts a stop and ends on its own.

  Done: "asked to stop" has three tests.
  - A single `implement` run: the stop command's own stream is empty, the
    run's stream announces the stop with its reason and `by`, and a task
    ticked under a fake 2-second interval ends it `cancelled` with no
    reason.
  - A `review` run hears the stop, and a marker naming another task does
    not end it. It ends `completed` on its own.
  - A stop for a run the runner does not hold is answered
    `nothing-to-stop`.

  `stop-boundary.test.ts` has eight tests for the shared module:
  - markers split across chunks;
  - a reply taken as said once something else happens;
  - no marker read from reasoning;
  - the ticked count;
  - events passed through unchanged;
  - a run ended at a marker;
  - a run ended at a tick;
  - a pending permission denied.

  All pass: `agent-runner` 24, `stop-boundary` 8, and `harness-chain-runner`
  102 against the shared module. Core, cli, server and extension typecheck.
  `agent-runner.test.ts` now states its time budget, and the budget policy
  check passes.

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
