# Design

See `docs/adr/0029-the-pipeline-is-where-a-change-is-run.md`, "The card
carries the controls, and each one reaches the run itself", and ADR 0028,
"A stop is a recommendation".

## Context

**Starting a run.**

- *Standalone:* "Run with Agentic Harness" in the Change Editor tab calls
  `resolveRunWithHarnessDispatch`, which opens `RunDialog`. The dialog only
  displays; choosing a path calls `startChosenRun`. The chain path shows
  `HarnessChainPanel`, and its "Start chain" button sends
  `{ kind: "chain", cwd, runId, context }` over the WebSocket.
- *Editor:* `openspec-ui.runWithHarness`, run on a tree item, reveals the AI
  panel with the plan. The webview renders `RunDialog` and posts the choice
  back to the host.

**Answering a run.** Only `HarnessChainPanel` shows "Continue to X with Y?".
`confirmCheckpoint` resolves the chain's `pendingCheckpoint`, and declining
sends a `cancel`. A permission request is answered with
`permissionRequestId` and `permissionOutcome`.

**Cancelling a run.** `HarnessChainRunner.cancel(runId)` resolves a pending
checkpoint as cancelled, or cancels the stage runner, which aborts the
agent's process.

- `websocket.ts` calls `cancel` and sends nothing back.
- `ai-panel.ts` posts `cancelling` itself.

**Where runs are held.** Every lookup is in memory:
`HarnessChainRunner.active`, `AgentRunner`'s active runs, the extension's
`RunController` (a single slot) and `runAgentIds`. In the extension, a
chain's scheduler entry is an observer with a random id.

**What the earlier changes provide.** After `a-run-says-which-task-it-is-on`
and `a-card-says-what-its-change-is-doing`, records carry `runId`, `task` and
`waiting`, and a card knows its live run's record and can say Waiting.

## Decisions

### A host keeps its runs in one core registry

`LiveRuns` wraps the event stream of every run the host starts. For each
run it holds the run id, the change name, the command kind, when the run
started, what it is waiting for, and whether a stop was asked. It forgets
the run at its terminal event.

The host uses the registry in two ways:

- to answer "which runs are mine", through `POST /api/live-runs` and
  `pipeline/live-runs`;
- to route an answer, a stop or a cancel for a run id to the runner that
  holds that run.

Rejected:

- **The chain panel's run id.** One panel holds one run, and the Pipeline
  is not that panel.
- **The process scheduler.** It exists to lock mutation per change. It
  carries no waiting state, the server lists only implement and chain runs
  in it, and the extension's entry for a chain is an observer with its own
  id.

### A card offers controls only for its host's runs

A card matches its live run's record `runId` against the host's list.

- **A run the host started:** the card says "Waiting for you" when the run
  waits, and offers Answer, Stop and Stop now.
- **A run the host did not start:** the card says "Waiting", says where,
  and offers none of those controls. It shows the folder the run was
  started in and can copy that path.

Rejected:

- **Offering the controls on every card and failing when sent.** A control
  that fails because it could never work should not have been offered.
- **Opening the other run's folder.** ADR 0029 rejects it, and the copied
  path serves the same need.

### Stop is a command of its own

The protocol gains a `stop { runId, reason }` command and a non-terminal
`stopRequested { reason, by?, outcome: "asked" | "nothing-to-stop" }`
event. The run then ends `cancelled`, with no rule reason, and the chain's
ending entry carries `stopRequest { reason, by }`.

Rejected:

- **`cancel` with a flag.** `cancel` terminates, and the requirements "A
  cancel command stops the run it names" and "A running agent process can be
  terminated" say so. One kind with two meanings lets a surface send the
  meaning it did not intend.
- **Ending with a `reason`.** On `cancelled`, a reason means a rule stopped
  the run, so a card would call a person's stop a limit.

### A run stops at a sound point

- **While it waits** at a checkpoint or on a permission, it stops at once.
- **While a stage runs,** it stops at whichever of these comes first:
  - the agent's reply names a task other than the one it last named
    (`readTaskMarker`), since the instruction asks for that line before any
    work on the task;
  - the change's ticked count (`countTasks`) rises above its value when the
    stop was asked, checked every 2 seconds and only while a stop is
    pending;
  - the stage ends.

  The stage's runner is then cancelled, and no further stage starts.
- **A single-stage run** follows the same rule without stages: a marker or a
  tick ends it. A `plan` or `review` run ticks nothing, so it ends at its
  own end; the card says so and offers Stop now.

Rejected:

- **Stopping only at stage boundaries.** A stage can run for half an hour,
  and a stop that waits that long is not a control.
- **Sending the agent a cancel through its session.** It ends the turn at
  once, wherever the edit stands. That is termination with extra steps.
- **Watching `tasks.md` all the time.** It costs a file read every two
  seconds for every run, for a stop that is almost never asked.

### Who asked is the host's git author

`by` is the host's configured git identity
(`GitWrapper.configuredIdentity`), stated as a git author, or absent when
none is configured. It is a claim; `a-run-is-signed-by-its-person` makes
it provable.

### Stop now is the existing cancel, offered only after a stop

Stop now appears only after Stop has been asked for.

Rejected:

- **Offering Stop now from the start.** The card's default must be the
  gentle action (ADR 0029).

### Start opens the run dialog, not a run

- *Standalone:* the card's Start opens `RunDialog` for that change, in a
  dialog over the Pipeline tab. A chosen chain path shows
  `HarnessChainPanel` inside the same dialog. Once the run starts, the
  dialog can be closed and the card carries the run from there.
- *Editor:* the card posts `openspec-ui/run-change`. The host checks the
  name as it does for `openspec-ui/open-change`, then runs
  `openspec-ui.runWithHarness` for that change.

Rejected:

- **Starting straight from the card with the resolved configuration.** The
  requirement "One entry starts a run, and it shows what it will do"
  applies, and the dialog is that entry.

### Both hosts give the same feedback

- The server answers a chain `cancel` through
  `HarnessChainRunner.asAgentRunner()`, which yields `cancelling`, as the
  extension already does.
- In both hosts, `stop` yields `stopRequested`.
- In the extension, a chain's scheduler entry takes the chain's `runId`,
  and "Cancel Process" on that entry calls `HarnessChainRunner.cancel`.

## Protocol

- **Commands added:** `stop`, with `runId` and `reason`. `cancel`,
  `confirmCheckpoint` and the permission answer are unchanged.
- **Events added:** `stopRequested`, which is non-terminal. No event changes,
  and `cancelled` keeps its meaning.
- **Compatibility:**
  - `COMMAND_KINDS` and `isEvent` gain the new kinds, and the transport
    contract test covers them.
  - A client from before this change never sends `stop`, and ignores
    `stopRequested` as a non-terminal kind it does not know, just as clients
    ignored ADR 0012's additive events.
  - A server from before this change refuses `stop` as an unknown kind. The
    card ships together with the server that accepts it.

## Non-Goals

- Stopping a run that another process started.
- Answering a run that another host started.
- Pausing a run.
- Giving a reason for Stop now.

## Risks / Trade-offs

- **A stop can wait a whole stage** when the agent names no task and ticks
  nothing. The card says what the run is waiting for, and Stop now remains
  for runs this host started.
- **A tick can land just after work on the next task began.** The run then
  stops with that task partly edited. The next run starts from `tasks.md`,
  and change-scoped rollback covers the files (ADR 0008).
- **The registry lives in memory.** A host that restarts forgets its runs,
  and their cards lose Answer and Stop. That is accurate, because the
  process that held those runs is gone.
- **`by` is a claim** until signatures exist.
