# Design

This change implements two decisions of
`docs/adr/0029-the-pipeline-is-where-a-change-is-run.md`: "What a card says
is derived in core, in words", and "The task in hand is what the agent
says, or a guess labelled as one".

## Context

**Cards today.** `PipelineView` builds a local card from
`ChangeReadinessReport`, which gives the run state, blockers and
collisions. It builds a foreign card from the survey through
`asLayoutInput`. Detail lines are budgeted by `pipelineCardDetailLines`.

**What the three blocking changes add.**

- `a-run-says-which-task-it-is-on` and `the-pipeline-opens-in-vs-code`:
  each surveyed run carries `task`, `waiting`, `runId`, `activityAt` and
  `heartbeatAt`.
- `a-change-is-running-when-its-run-says-so`: readiness calls a change
  running when its run's record says so, and a worktree names the change
  it belongs to.
- `the-pipeline-opens-in-vs-code`: both hosts render `PipelineView`.

**The audit log.**

- Every stage run writes a `started` entry and a terminal partner under the
  chain's `runId`. Each carries `stage`, `changeDir`, `usage` and `reason`.
- `readRepositoryAuditEntries` merges the logs of every working directory.
- `isRunEntry` is the single rule counters use to skip entries that are not
  runs. Today it skips `verify-checks` entries, which have a terminal entry
  and no `started` partner. `buildChangeCostReport` and
  `buildWorkspaceRunStats` call it.

**Chain endings with no entry.** Three endings write nothing: a cancel
while the chain waits at a checkpoint, the run-time limit, and the attempt
limit.

**`cancelled` reasons.** `cancelled` carries a `reason` only when a rule
stopped the run. No reason means a person asked.

## Decisions

### One pure function derives every card

`change-card.ts` uses no Node built-ins and is exported from `browser.ts`.
It holds two functions:

- `describeChangeCards({ report, survey, lastRuns, now })` returns one
  `ChangeCard` per change of the report.
- `describeChangeCard(card, now)` turns one card into its words.

The view calls both, as it already calls `layoutChanges`.

Rejected:

- **An endpoint that returns finished cards.** The editor would need a
  second copy of that endpoint's assembly, and the view could no longer
  re-age a card between readings.
- **Words written in the view.** The two hosts share one component, but the
  terminal does not share it, and the words are the part most likely to be
  printed there later.

### The state is decided by precedence

The first rule that matches decides the state:

1. **Waiting**, when a live run of the change has a record that says it is
   waiting. A live run is one surveyed in this directory, or in the
   change's own worktree, that is not gone.
2. **Running**, for any other live run. A change readiness calls running,
   with a lease and no record, is also Running, with no stage.
3. **Failed at a stage** or **Stopped at a stage**, when the latest run
   ended that way and the change's task list has not changed since.
4. **Blocked**, when readiness says so.
5. **Done**, when every task is ticked.
6. **Ready**, otherwise.

Rejected:

- **Letting a failure stand until a new run.** A person who fixes the work
  by hand and ticks the tasks would read "Failed" forever.
- **Dropping a failure after a fixed time.** How long is right depends on
  the person, and a time rule would say "Ready" about a change nobody has
  touched.

### A failure goes stale when the task list changes after it

The survey carries `tasksModifiedAt`, the modification time of the task
list.

Rejected:

- **Reading the file's git history.** That costs a subprocess per change
  per reading. ADR 0026 refuses subprocesses for foreign directories, and
  the survey reads every directory.

### Stopped is not Failed

- `failed` reads as **Failed at a stage**.
- `cancelled` with no reason reads as **Stopped at a stage**.
- `cancelled` with a reason also reads as **Stopped at a stage**, followed
  by the reason.

A configured limit that stops a run is not a fault in the work either. It
is a ceiling, and it is stated as one, as the requirement "A run stopped by
a rule says so" already does.

### The task in hand comes from the run, or from a guess

The card takes the run's `task`, which is already paired with the task
list. When a run is under way and names no task, the card takes the
survey's `nextOpenTask`, the first open item that is neither Human-only nor
delegated, and says "probably". When nothing runs, there is no guess.

### How the last run ended

`readLastRuns({ workspaceRoot })` in `last-runs.ts` works as follows:

1. It reads `readRepositoryAuditEntries`.
2. It keeps `isRunEntry` entries and chain endings.
3. It groups them by `runId`, and keys each run by
   `changeNameOf(changeDir)`.
4. For each change, it takes the latest run that has ended. A run with no
   terminal entry is still live, is shown from its record rather than the
   log, and is skipped here in favour of the previous run that ended.
5. The ending comes from the chain's ending entry when there is one, and
   otherwise from the last terminal entry. The stage comes from that entry,
   or else from the run's last entry that has a stage.
6. The cost is the sum of the run's reported `usage.costUsd`. It is absent
   when no entry reported one.

Parsed entries are cached per audit file, keyed by path, size and
modification time. A poll that finds no log changed parses nothing.

Rejected:

- **The rows of `buildChangeCostReport`.** They carry no run id, so a
  change's runs cannot be told apart.

### A chain writes its own ending

`HarnessChainRunner` writes one entry at every chain ending, with:

- `agent: CHAIN_ENDING_AGENT_NAME`, which is `"chain"`;
- `outcome`;
- the `stage` the chain ended at;
- `reason`;
- `changeDir`;
- no `usage`.

`isRunEntry` skips it, as it skips `verify-checks`. No counter therefore
reads it as a run refused before it started, and `readLastRuns` reads it on
purpose.

Rejected:

- **A `started` and terminal pair, as `git-stage` writes.** A chain is not
  a unit of work of its own; its stages are. A pair would count every chain
  as one more run.

### Carried to both hosts

- **Standalone:** `POST /api/change-last-runs` with `{ cwd }`, authorized
  as `/api/change-readiness` is.
- **Editor:** `pipeline/last-runs` on the pipeline panel.

`PipelineView` takes `lastRuns?` and reads it on the survey's cadence, or
on the survey's signal. When a run ends, its status record is removed, and
in the editor that removal is the survey's signal.

## Protocol

No command or event changes. One REST route and one bridge operation are
added; neither belongs to the command and event protocol.

The audit log gains an entry that is identified by its `agent`. Readers
from before this change would count it as a run. `isRunEntry` changes in
this same change, so none of the product's own readers does.

## Non-Goals

- Controls on a card, and the words "Waiting for you".
- A card's list of tasks.
- A terminal command that prints cards.
- Any run before the latest one.

## Risks / Trade-offs

- **Any edit to the task list clears a failure, not only a tick.** Changing
  a task's wording removes "Failed" from the state word, but the last-run
  line still says the run failed.
- **A renamed change loses its runs.** `changeNameOf(changeDir)` gives the
  name the change had when it ran, so its runs do not follow the new name.
  `runTimestampsByChange` has the same limitation.
- **A rotated log forgets older runs.** A log rotated past 5,000 entries
  loses a change's older runs. The card then says less; it never says
  something different.
- **Mixed versions write no ending.** A chain run by a host older than this
  change writes no ending entry. Its last run is then read from the last
  stage's terminal entry, which is what that log contains.
