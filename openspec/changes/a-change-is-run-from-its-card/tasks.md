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
- [x] 1.4 `AuditEntry` in `packages/core/src/security.ts` gains
  `stopRequest?: { reason: string; by?: string }`. It is written only on a
  chain ending entry, after a requested stop.

  Done: the field is declared with a comment on why it is not `reason`.
  `recordEnding` in `harness-chain-runner.ts` is the only writer (3.6), and
  the "asked to stop" tests check it on the ending entry (3.9).

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
- [x] 2.5 Check each junction below, and record it: while running, each run
  appears in its host's `list()`.
  - a chain started from the Change Editor;
  - a chain started from the editor's AI panel;
  - a single-stage run from each host's AI panel;
  - a delegated item's run from each host.

  Checked, junction by junction, against the code and the test that sees
  it held:
  - Standalone chain, from the Change Editor, the AI panel or a card:
    `streamChainEvents` in `websocket.ts` runs the chain through
    `liveRuns.track`. Seen held in a browser by 6.1: the card offers its
    controls only for a run `/api/live-runs` lists.
  - Standalone single-stage run: `dispatchSingleStage` runs through
    `liveRuns.runner`. `server.test.ts` lists a gated `review` run while it
    goes on, not for another workspace, and not after it completes.
  - Standalone delegated item: `handleDelegatedItemRunRequest` resolves its
    runner through `liveRuns.runner`, which `live-runs.test.ts` covers.
  - Editor chain, from the Change Editor (`openspec-ui.runWithHarness`
    opens the AI panel's chain) and from the AI panel: `AiPanel` runs
    `chainRunner.asAgentRunner()` through `RunController.run`. That
    method tracks every command it runs, which `run-controller.test.ts`
    covers.
  - Editor single-stage run: the AI panel runs it through
    `RunController.run` too.
  - Editor delegated item: `extension.ts` wraps the resolved runner in
    `liveRuns.runner`.

  The live runs in 7.5 and 7.6 exercise a chain in each host.

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

- [x] 4.1 `websocket.ts` handles both a chain `cancel` and `stop` through
  `chainRunner.asAgentRunner()`, so the socket receives `cancelling` or
  `stopRequested`. Both events go to the socket that sent the command. Cover
  this in the server's websocket tests.

  Done: `HarnessChainRunner.holds(runId)` says whether a chain is active.
  - A `cancel` or `stop` naming one runs through `asAgentRunner()`, and its
    events go to the socket that sent it: `cancelling` for a cancel. A
    stop's `stopRequested` travels on the chain's own stream (see 3.4),
    which is that same socket's.
  - A `cancel` or `stop` for a single-stage run names no agent, so it now
    goes to the runner that holds the run. `LiveRun` gained `agentId`;
    without it, the default runner would answer "nothing to stop" for a
    run on another agent.

  `server.test.ts`:
  - "routes a chain command to HarnessChainRunner and resolves cancel
    against its checkpoint" now also expects `cancelling` with
    `termination-requested` on the sending socket.
  - A new test stops a chain at its checkpoint over the socket, and sees
    one `stopRequested` with the reason, then `cancelled`.

  Server typecheck and lint are clean. The selected server tests pass, 8;
  core passes, `live-runs` 8 and `harness-chain-runner` 102.
- [x] 4.2 `trackHarnessProcess` in `packages/extension/src/webview/ai-panel.ts`
  gives a chain's scheduler entry the chain's `runId`. Cancelling that entry
  from the Processes tree calls `HarnessChainRunner.cancel` for the chain.
  Cover this in the extension's tests.

  Done: a chain's entry is started with `id` set to the chain's `runId`. If
  that id is already an entry, the scheduler throws, and the chain is
  tracked under a fresh id rather than going untracked. "Cancel Process"
  aborts the entry's signal, and the chain's `execute` now listens for
  that abort and calls `chainRunner.cancel(runId)`. Before this, the
  signal was ignored, and cancelling the entry left the chain running.

  `ai-panel.test.ts` "AiPanel harness process tracking" gains two tests:
  - the entry carries `chain-1`, and aborting its signal cancels `chain-1`;
  - a taken id falls back to an entry started without one.

  The file passes, 40 tests, and the extension typechecks.

## 5. The card's controls

- [x] 5.1 `describeChangeCards` in `packages/core/src/change-card.ts` takes
  `liveRunIds` and marks a live run whose `runId` is among them as
  `ownedHere`. For such a waiting run, `describeChangeCard` says
  `Waiting for you` instead of `Waiting`. Do not compute this in the view.

  Done, with the word ADR 0029 gives. A card's word comes from
  `describeChangeState`, which the Changes list and `ready` also call, so
  the rule lives there. ADR 0029 says "Waiting for you, where the answer
  can be given from here, or Waiting in `label`". A run waiting here that
  this host does not hold therefore reads `Waiting in <this checkout's
  label>`, not a plain `Waiting`: it is still waiting, and still said with
  where.
  - `ChangeStateFacts` gains `answerableHere`. With it, a run waiting here
    reads `Waiting for you`, and without it `Waiting in` the checkout's
    label. The Changes list and `ready` pass none, which is true of them:
    they hold no run.
  - `describeChangeCards` takes `liveRunIds`. The run a card shows now
    carries `runId` and `ownedHere`, and a waiting run that is owned here
    passes `answerableHere` into the word.
  - A waiting run not held here has its line end `— answered where it was
    started` (5.7's words).

  Tests:
  - `change-state-word.test.ts` has both forms of the word.
  - `change-card.test.ts` has a waiting run held by nobody, which reads
    `Waiting in repo`, and a new test for a run held here and one held
    elsewhere, with their words, `ownedHere` and lines.

  Core passes, 63 tests across the word, card and survey files. Core,
  webui, extension, cli and server typecheck.
- [x] 5.2 Start is offered when the card's state is `ready`, `failed` or
  `stopped`.
  - Standalone: it opens `RunDialog` for that change in a
    `role="dialog"` layer over the Pipeline tab. Focus moves into the
    dialog, and returns to Start when it closes. A chosen chain path shows
    `HarnessChainPanel` inside the dialog.
  - Editor: it posts `openspec-ui/run-change`. The pipeline panel checks the
    name as it does for `openspec-ui/open-change`, then runs
    `openspec-ui.runWithHarness` for that change.

  Done. The view offers Start only on a card with no run and one of those
  three states.
  - Standalone (`standalone-entry.tsx`): the run dialog's state now carries
    the change it is for and where it was opened. Apply, use-agent and
    schedule act on that name, not on the Change Editor's selected change,
    which a card's Start never set. A card's Start opens the dialog in a
    layer beneath the picture and focuses it; choosing the chain shows
    `HarnessChainPanel` in a `role="dialog"` section in that layer, which
    takes focus in turn. Closing either returns focus to the card's Start.
    A dialog opened from the Change Editor behaves as before.
  - Editor: `pipeline-entry.tsx` posts `openspec-ui/run-change`.
    `PipelinePanel` checks the name as it does for opening a change and
    runs the command. `pipeline-panel.test.ts` covers an accepted and a
    refused name.
- [x] 5.3 `openspec-ui.runWithHarness` in `packages/extension/src/commands.ts`
  accepts a change name as well as a tree item. It refuses a name that is
  not an active change of the workspace, and says so.

  Done: a name is looked up among the workspace's active changes and run
  as that change's tree item. An unknown name gets the warning
  `OpenSpec UI: <name> is not an active change of this workspace, so it
  cannot be run.` and nothing runs. Two tests in `commands.test.ts`; the
  file passes, 140 tests.
- [x] 5.4 Answer, on a card whose run is `ownedHere`:
  - at a checkpoint, `Continue to <nextStage>` sends `confirmCheckpoint`,
    and `Stop` opens the reason form and sends `stop`;
  - on a permission, `Allow` and `Deny` send the existing permission answer,
    beside the permission's description.

  Done. Standalone sends each control over the page's WebSocket, with the
  run's id and change directory. The editor posts
  `openspec-ui/run-control`; `PipelinePanel` carries it out only for a run
  this host holds, on the same change, in its own workspace, and the
  extension sends it to the chain runner or the run's own runner.
- [x] 5.5 Stop, on a card whose run is `ownedHere` and has no stop asked: the
  `Stop` button opens a form with one required reason field and an
  `Ask to stop` button, which sends `stop`. The card then states the
  request from the record: `asked to stop: <reason>`.

  Done. After any control, the view reads the runs, the survey and the
  standings again one second later (`RUN_CONTROL_REREAD_MS`), so the card
  states the record without waiting for the next survey 30 seconds later.
  A test covers that read.
- [x] 5.6 Stop now, on a card whose run is `ownedHere` and has a stop asked:
  the `Stop now` button sends `cancel`.
- [x] 5.7 A card whose run is not `ownedHere` offers no Answer, Stop or Stop
  now. A waiting run's line says it is answered where it was started. The
  card shows the run's working directory with a `Copy folder path` button,
  and offers nothing that opens the folder.
- [x] 5.8 Every control is a button, and its accessible name includes the
  change's name.

  Done, for 5.6 to 5.8: `Start <name>`, `Continue <name> to <stage>`,
  `Allow <name>: <description>`, `Deny <name>: <description>`,
  `Stop <name>`, `Stop <name> now` and `Copy folder path of <name>`. The
  reason form is a dialog named `Ask <name> to stop`. The card itself is a
  group whose name is a button, since a button cannot hold buttons.
- [x] 5.9 webui `PipelineView.test.tsx`:
  - for a run that is `ownedHere`, the right controls appear and send the
    right command: at a checkpoint, on a permission, and while running both
    with and without a stop asked;
  - for a run that is not `ownedHere`, no controls appear, and copying the
    path copies the working directory;
  - Start opens the dialog for its change;
  - the reason form refuses an empty reason.

  Done: "a card's controls" has seven tests, the six above and the read
  after a control. The empty reason is refused in the checkpoint test.
  Start is checked to ask its host for that change's dialog; opening the
  dialog is the host's, and 6.1 covers it in a browser. The file passes,
  42 tests.

## 6. Browser suite

- [x] 6.1 browser `e2e/pipeline.spec.ts`, with a stand-in agent:
  1. start a chain from a card;
  2. answer its checkpoint on the card;
  3. ask it to stop, with a reason;
  4. confirm the card says the run was asked to stop.

  The tab passes axe at WCAG AA while the reason form is open.

  Done: "starts a chain from its card, answers it there, and asks it to
  stop" passes against a server with the stand-in runner. That runner now
  takes a `verifyGate`, which holds the verify stage open. The test
  checks:
  - focus is in the run dialog, and then in the chain's section;
  - the card's Continue is pressed at each checkpoint until the card
    offers Stop and no Continue;
  - axe is clean while the reason form is open;
  - the card says `asked to stop` and `wrong branch`.

  The first run found a real defect: the chain's event log scrolls, and
  could not be reached by keyboard (axe `scrollable-region-focusable`).
  It is now focusable and named `Chain events`. The file passes, 3 tests.

## 7. Verification

- [x] 7.1 This change validates strictly. `check(validate-change)`

  Done: `openspec validate a-change-is-run-from-its-card --strict` reports
  the change valid.
- [x] 7.2 `npm run verify` unpiped, after the last code edit and with
  everything staged. Record the run and the test count for each package.

  Run on 2026-09-14 at 09:07, unpiped, after the last code edit and with
  everything staged. Typecheck and lint passed. The tests:
  - cli: 155 in 15 files, all passed;
  - core: 1425 in 103 files, with 1424 passed and 1 failed;
  - extension: 367 in 27 files, all passed;
  - server: 99 in 4 files, all passed;
  - webui: 461 in 51 files, all passed.

  The core failure was "reads a directory and a file from a branch that
  is not checked out", in `git-refs.test.ts`, and it is not this change's.
  Git's own `sh.exe` died during the test's `git push` with
  `fatal error - add_item ("\??\C:\Tools\Git", "/", ...) failed, errno 1`,
  an MSYS runtime failure under load. The file alone passed, 3 of 3.
  CI then ran the whole suite in one run on #495, at `127691f`:
  "Typecheck, lint, test, and build" passed, as did "Extension
  integration and package" and "OpenSpec change validation (merge gate)".
- [x] 7.3 A pending changeset exists: core, server, extension and webui are
  each minor. `check(changeset-present)`

  Done: `.changeset/a-change-is-run-from-its-card.md` names
  `@openspec-ui/core`, `@openspec-ui/webui`, `@openspec-ui/server` and
  `openspec-ui-vscode` (the extension), each minor.
- [x] 7.4 Run the whole browser suite, not a selected spec.

  Done on 2026-09-14: `npm run test:browser` in `packages/server`,
  unpiped, with the client built from this branch. 19 passed in 3.9
  minutes. CI's "Standalone browser and accessibility" passed on #495 at
  `127691f`. The screenshots the suite regenerated differed only as
  captures, and were not committed.
- [x] 7.5 **Delegated to claude-cli**: a live stop in the standalone server.

  Done on 2026-09-14, in two runs of one foreground Node driver (kept
  outside the repository). It:
  - rebuilt the client with `node scripts/build-client.mjs` in
    `packages/server`;
  - started `tsx src/cli.ts <scratch repo> 4831` from this branch, with a
    stand-in `claude.cmd` first on `PATH` and `OPENSPEC_UI_WORKTREE_ROOT`
    under temp;
  - drove the Pipeline tab in headless Chromium through Playwright,
    recording every WebSocket frame with its time.

  The scratch repository (`%TEMP%/openspec-ui-live-stop-ibXbWk/repo`, git
  identity `live-check@example.com`) held one change, `live-stop`, whose
  `harness.json` is semi-autonomous with `claude-cli` on every stage. The
  stand-in wrote `tasks.md` (1.1, 1.2) for `plan`, did nothing for
  `review`, and for `implement` did exactly what the setup above says.

  Run 1 is not the evidence. It had a `tasks.md` from the start, and a
  chain whose proposal and tasks exist starts at `apply` (`design` is
  optional), so no checkpoint came before the stop. Run 2 has no
  `tasks.md`, so the chain starts at `propose`.

  Run 2, step by step (UTC):
  1. 06:23:46.140 Start pressed on the card. The run dialog opened over the
     Pipeline tab; the chain path was chosen and Start chain pressed. The
     `chain` command was sent at 06:23:48.082.
  2. The card's `Continue live-stop to review` sent `confirmCheckpoint` at
     06:23:51.689. Its `Continue live-stop to apply` sent the next at
     06:23:53.235.
  3. The stand-in printed `Starting task 1.1` at 06:23:56.263. Stop on the
     card, with the reason `live check` and `Ask to stop`, sent `stop` at
     06:23:56.692, before 1.1 was ticked.
  4. The chain ended at 06:24:11.527, 14.7 s after the stop was asked.

  WebSocket events from `stopRequested` through `cancelled` (the server's
  `timestamp`, then when the page received it):
  - `stopRequested` `{ reason: "live check", by: "live-check@example.com", outcome: "asked" }`,
    06:23:56.826, received 06:23:56.828;
  - `stdout` `Starting task 1.2`, 06:24:11.277, received 06:24:11.340;
  - `cancelled`, with no `reason`, 06:24:11.527, received 06:24:11.528.

  `cancelled` came 0.25 s after the `Starting task 1.2` line, and 45 s
  before the stand-in's 60 seconds would have run out. The stand-in ticked
  1.1 at 06:24:11.275 and printed the marker 1 ms later, so the run does
  not show which of the two boundaries fired.

  The stand-in never logged its own exit, and no stand-in process was
  alive afterwards. `tasks.md` was left with 1.1 ticked and 1.2 not.

  The chain ending entry in `.openspec-ui/audit.jsonl`:
  `{"runId":"9c338f33-e47d-4a17-8053-49eee89cece7","agent":"chain","outcome":"cancelled","timestamp":"2026-09-14T06:24:11.527Z","stage":"apply","stopRequest":{"reason":"live check","by":"live-check@example.com"}}`,
  with `cwd` and `changeDir` omitted here and no `reason`. The apply
  stage's own entry is `cancelled` at 06:24:11.528.

  The card's text while the stop was pending, read every second (the
  scratch path shortened to `<repo>`):
  - 06:23:56.700, as Stop was pressed: `live-stop RUNNING on task 1.1:
    First task, by its own account +3 running apply — said 3s ago 0 of 2
    tasks done in <repo> Stop`;
  - from 06:23:58.728 until the end: `live-stop RUNNING on task 1.1: First
    task, by its own account +3 asked to stop by live-check@example.com:
    live check — said 0s ago 0 of 2 tasks done in <repo> Stop now`, with
    only the age changing.

  Read again after the end: `live-stop STOPPED AT APPLY 1 of 2 tasks done
  +2 last run stopped at apply 4s ago no working directory of its own —
  openspec-ui-cli worktree add live-stop Start`.

  Where and how, for 7.5 and 7.6:
  - Work in this working directory, which is on the branch
    `implement-a-change-is-run-from-its-card`. Do not touch
    `C:\Prog\OpenSpec-UI` or any other checkout.
  - Take every step in a foreground command. A command sent to the
    background ends the run with nothing recorded.
  - Port 4817 is taken by the server that started this run. Use another
    port.
  - Put the scratch repository and the stand-in under the system's temp
    directory. Change no tracked file except this task list.

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

  Not closed. Step 1 works in the editor. Step 2 cannot be taken as
  written: the Processes tree offers no Cancel Process on a chain's row.
  The run also found that the card's Continue answers nothing in the
  editor. Both defects are described at the end, and neither is fixed
  here, since this run may change only this task list.

  Run on 2026-09-14 by one foreground Node driver, kept outside the
  repository. It:
  - built `packages/extension/dist` with the esbuild options of
    `scripts/build-options.mjs` plus one resolve plugin. `node_modules` is a
    junction to the main checkout, so `@openspec-ui/core` would otherwise
    bundle `C:/Prog/OpenSpec-UI/packages/core`. The plugin points
    `@openspec-ui/core`, `@openspec-ui/core/browser` and
    `@openspec-ui/server` at this worktree's `src`. The source map of
    `dist/extension.js` lists 128 core sources, none from the main
    checkout, `live-runs.ts` and `stop-boundary.ts` among them;
  - launched VS Code 1.137.0 through Playwright's Electron driver, from the
    archive already cached under
    `C:/Prog/OpenSpec-UI/packages/extension/.vscode-test`. It was run only,
    with its user data and extensions directories under temp. Both
    `--extensionDevelopmentPath` values were given: this branch's
    `packages/extension`, and a helper extension kept outside the
    repository;
  - put 7.5's stand-in `claude.cmd` first on `PATH`, set
    `OPENSPEC_UI_WORKTREE_ROOT` under temp, and removed every inherited
    `VSCODE_*` and `ELECTRON_*` variable.

  The extension writes no log line of its own for a chain's events; the AI
  panel only posts them to its webview. The helper extension therefore
  subscribes, in the same extension host, to the `runController.onEvent`
  the extension exports. It writes each event, with the time, to an output
  channel and a file. Those are the log lines below.

  The scratch repository is `%TEMP%/openspec-ui-editor-stop-0nT8Wa/repo`.
  It holds 7.5's `live-stop` change, with git identity
  `live-check@example.com`. Before each run it got a `tasks.md` with 1.1
  and 1.2 open, so the chain starts at `apply` with no checkpoint before
  the stop. The second defect below is why.

  **Run A: a stop from the pipeline panel** (chain
  `c333761c-918f-48a1-af0b-13f42dda78f9`, times UTC):
  1. After `OpenSpec UI: Open Pipeline`, `Start live-stop` was pressed on
     the card at 06:50:27.356. The run dialog opened in the AI panel, where
     `Run the chain (configured)` and then `Start chain` were pressed, the
     latter at 06:50:30.873.
  2. The stand-in printed `Starting task 1.1` at 06:50:37.910.
  3. On the card: `Stop live-stop`, the reason `live check` in the
     `Ask live-stop to stop` form, and `Ask to stop` at 06:50:38.602.

  The extension host's log lines from `stopRequested` through `cancelled`
  (the time the helper wrote the line, then the event):
  - `06:50:38.848Z event stopRequested {"kind":"stopRequested","runId":"c333761c-918f-48a1-af0b-13f42dda78f9","timestamp":"2026-09-14T06:50:38.847Z","reason":"live check","by":"live-check@example.com","outcome":"asked"}`
  - `06:50:52.978Z event stdout`, timestamp `2026-09-14T06:50:52.913Z`,
    chunk `Starting task 1.2` and its newline;
  - `06:50:53.248Z event cancelled {"kind":"cancelled","runId":"c333761c-918f-48a1-af0b-13f42dda78f9","timestamp":"2026-09-14T06:50:53.248Z"}`,
    with no `reason`.

  The AI panel's webview received the same three events at 06:50:38.852,
  06:50:52.982 and 06:50:53.252.

  How it ended:
  - `cancelled` came 0.34 s after `Starting task 1.2`, 14.6 s after the
    stop was asked, and 59.7 s before the stand-in's 60 seconds would have
    run out.
  - As in 7.5, the stand-in ticked 1.1 at 06:50:52.914 and printed the
    marker 1 ms later, so the run does not show which boundary fired.
  - `tasks.md` was left with 1.1 ticked and 1.2 open, and no stand-in
    process was alive.

  The card's text. The scratch repository has no working directory of its
  own, so no path appears:
  - 06:50:38.449, before Stop: `live-stop READY on task 1.1: First task,
    by its own account running apply — said 0s ago 0 of 2 tasks done no
    working directory of its own — openspec-ui-cli worktree add live-stop
    Stop`. From the next read, at 06:50:39.732, it said RUNNING.
  - From 06:50:40.745 until the end, with only the age changing:
    `live-stop RUNNING on task 1.1: First task, by its own account asked to
    stop by live-check@example.com: live check — said 1s ago 0 of 2 tasks
    done no working directory of its own — openspec-ui-cli worktree add
    live-stop Stop now`.
  - 06:50:57.995, after the end: `live-stop STOPPED AT APPLY 1 of 2 tasks
    done last run stopped at apply 2s ago no working directory of its own
    — openspec-ui-cli worktree add live-stop Start`.

  Run A's entries in `.openspec-ui/audit.jsonl`, with `cwd`, `changeDir`
  and `invocation` omitted:
  - `{"runId":"c333761c-918f-48a1-af0b-13f42dda78f9","agent":"claude-cli","outcome":"started","timestamp":"2026-09-14T06:50:37.729Z","stage":"apply"}`
  - `{"runId":"c333761c-918f-48a1-af0b-13f42dda78f9","agent":"claude-cli","outcome":"cancelled","timestamp":"2026-09-14T06:50:53.250Z","stage":"apply"}`
  - `{"runId":"c333761c-918f-48a1-af0b-13f42dda78f9","agent":"chain","outcome":"cancelled","timestamp":"2026-09-14T06:50:53.248Z","stage":"apply","stopRequest":{"reason":"live check","by":"live-check@example.com"}}`,
    with no `reason`.

  **Run B: Cancel Process** (chain `02a4e5ce-f5f8-4c24-baf4-bfcf4907c4e6`).
  After `View: Close All Editors` and a fresh `tasks.md`, the chain was
  started from the card again, the same way. The stand-in printed
  `Starting task 1.1` at 06:51:09.482.
  - The Processes view showed the chain's row as
    `chain live-stop · 0% · running`. Hovered, it showed no inline action;
    right-clicked, it opened no context menu.
  - So Cancel Process could not be used from the tree. At 06:51:12.324 the
    helper ran `openspec-ui.cancelProcess` with
    `{ process: { id: "02a4e5ce-f5f8-4c24-baf4-bfcf4907c4e6" } }`, the
    argument the tree's inline action passes.

  The extension host's log lines:
  - `06:51:12.324Z openspec-ui.cancelProcess for the entry 02a4e5ce-f5f8-4c24-baf4-bfcf4907c4e6`
  - `06:51:12.399Z openspec-ui.cancelProcess returned`
  - `06:51:12.600Z event cancelled {"kind":"cancelled","runId":"02a4e5ce-f5f8-4c24-baf4-bfcf4907c4e6","timestamp":"2026-09-14T06:51:12.600Z"}`,
    with no `reason`.

  Cancel Process terminates, so no `stopRequested` belongs here. The chain
  ended 0.28 s after the command, before 1.1 was ticked. The stand-in
  logged nothing after its marker, and no stand-in process was alive
  afterwards.

  Run B's audit entries:
  - `{"runId":"02a4e5ce-f5f8-4c24-baf4-bfcf4907c4e6","agent":"claude-cli","outcome":"started","timestamp":"2026-09-14T06:51:09.327Z","stage":"apply"}`
  - `{"runId":"02a4e5ce-f5f8-4c24-baf4-bfcf4907c4e6","agent":"claude-cli","outcome":"cancelled","timestamp":"2026-09-14T06:51:12.601Z","stage":"apply"}`
  - `{"runId":"02a4e5ce-f5f8-4c24-baf4-bfcf4907c4e6","agent":"chain","outcome":"cancelled","timestamp":"2026-09-14T06:51:12.600Z","stage":"apply"}`,
    with no `stopRequest` and no `reason`.

  So 4.2's routing works once the command is reached. The chain's
  scheduler entry carries the chain's run id, and cancelling that entry
  cancels the chain and ends its agent's process.

  Defects found, not fixed:
  1. **The Processes tree offers no Cancel Process on a chain.**
     - In `packages/extension/src/tree/processes-tree.ts:64-75`,
       `ProcessTreeItem` gives a running process
       `openspec-ui.implementationProcess` only when its operation is
       `implement`. Every other process, a running chain included, gets
       `openspec-ui.finishedProcess`.
     - The inline `openspec-ui.cancelProcess` in `package.json:476-480`
       shows only for `openspec-ui.cancellableProcess` or
       `openspec-ui.implementationProcess`, and nothing sets
       `openspec-ui.cancellableProcess`.
     - So the requirement "Cancelling a chain from the Processes tree stops
       the chain" cannot be met from the tree.
  2. **The card's Continue answers nothing in the editor.** This is 5.4's
     editor half.
     - `sendRunControl` in `packages/extension/src/extension.ts:473-500`
       sends every control for a chain through
       `chainRunner.asAgentRunner()`.
     - `asAgentRunner` (`packages/core/src/harness-chain-runner.ts:746-792`)
       handles `cancel`, `stop` and `resolvePermission`, and passes
       anything else to `run()`. `run()` yields `failed` for any kind but
       `chain` (`:524-528`), and `sendRunControl` discards that stream.
     - The server calls `chainRunner.confirmCheckpoint` directly
       (`packages/server/src/websocket.ts:102-105`), which is why 7.5
       passed.
     - Two earlier runs of this driver had no `tasks.md` and saw it. The
       card read `WAITING FOR YOU` and offered
       `Continue live-stop to review`. After the chain's `checkpoint` event
       (06:40:17.392 in one run, 06:46:33.923 in the other), the host
       logged nothing more. In the first run the card's Continue was
       pressed about 120 times over four minutes; in the second, once,
       with a 5-second wait.

  What closes this task: fix both defects, rebuild, and take step 2 from
  the tree's own Cancel Process. Step 1's evidence can stand unless the fix
  touches the stop path.

  Both defects fixed on 2026-09-14, after the run above. Neither fix
  touches the stop path.
  1. `ProcessTreeItem` gives a queued or running `chain` the
     `openspec-ui.cancellableProcess` context, which the inline Cancel
     Process already shows for. `processes-tree.test.ts` has a test for a
     running, a queued and a cancelled chain.
  2. The editor's card controls moved from `extension.ts` into
     `packages/extension/src/pipeline-run-control.ts`. For a chain it holds,
     `sendPipelineRunControl` now answers `confirmCheckpoint` with
     `chainRunner.confirmCheckpoint(runId)` and `resolvePermission` with
     `chainRunner.resolvePermission(command)`, as the server's socket does.
     A cancel and a stop still go through `asAgentRunner()`.
     `pipeline-run-control.test.ts` has 5 tests: checkpoint, permission,
     a chain's stop, a single-stage run's cancel, and a run not held.

  Extension typecheck and lint are clean. The processes tree, run control
  and pipeline panel tests pass, 38. Still to take for this item: step 2
  from the tree's own Cancel Process, and a Continue on the card at a
  checkpoint before the stop, both in an Extension Development Host built
  from this branch.
