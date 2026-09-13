# A card says what its change is doing

## Why

ADR 0029 decides what a card states, in words that one core function
derives:

- its state, as a word from a closed set;
- the stage and activity of a run under way, and how long since the run
  said so;
- its task progress;
- how its last run ended;
- the directory and branch its facts were read from.

A local card today states whether its change is running, ready or blocked,
and nothing else.

- **A local card shows no task progress.** `PipelineView` builds local
  cards from the readiness report, which carries no task data. Only a card
  for another working directory shows "N of M tasks done".
- **A card shows no run.** What this directory's runs say is a list of
  lines above the picture, matched to the directory rather than to a
  change.
- **A card shows no history.** No core function answers "how did this
  change's last run end". The rows of `buildChangeCostReport` carry no run
  id, so they cannot be grouped into runs. A chain that is cancelled at a
  checkpoint, or stopped by its time or attempt limit, writes no audit
  entry for that ending.
- **A card has no guess and no word for waiting.** When a run names no
  task, nothing offers the likely one. A run waiting at a checkpoint has
  no word on a card.

## Capabilities

### New

- `describeChangeCards` derives one card per change of this checkout, in
  core, from the readiness report, the survey and the last runs. A card
  holds:
  - its state word;
  - its run;
  - its task in hand, or a guess labelled as one;
  - its progress;
  - its last run;
  - where its facts came from.
- `readLastRuns` reads each change's latest run from the audit logs of
  every working directory, grouped by run: how it ended, where, when, and
  at what cost.
- A chain writes its own ending to the audit log, including a cancel at a
  checkpoint and a stop by a time or attempt limit.
- Both hosts carry the last runs to the view: a standalone route, and a
  bridge operation in the editor.

### Modified

- For each change, the survey also carries:
  - how many open items only a person can close;
  - how many open items only another agent can close;
  - the first open task an agent may do;
  - when the task list last changed.
- `PipelineView` draws each local card from `describeChangeCards`.
- The readers that total the audit log by agent leave out the chain's
  own ending entries.

## Impact

- `packages/core`:
  - new `change-card.ts`, which is safe to use in a browser;
  - new `last-runs.ts` and its facts;
  - `harness-chain-runner.ts`;
  - `worktree-survey.ts`;
  - the readers that total the audit log.
- `packages/server`: `POST /api/change-last-runs`.
- `packages/extension`: `pipeline/last-runs` on the pipeline panel.
- `packages/webui`: a client for the route, the cards in `PipelineView`,
  and the card's stylesheet for the state words.

## Out of scope

- Controls on the card, and the words "Waiting for you". Both belong to
  `a-change-is-run-from-its-card`.
- A card's list of tasks, which belongs to `a-card-opens-to-its-tasks`.
- Printing cards in the terminal. The function is shaped so a command
  could use it; that command is a change of its own.
