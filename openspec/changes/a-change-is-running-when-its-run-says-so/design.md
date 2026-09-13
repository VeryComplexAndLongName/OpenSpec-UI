# Design

See `docs/adr/0029-the-pipeline-is-where-a-change-is-run.md`, "A change is
one card, wherever it is being worked".

## Context

- **How readiness decides a change is running.** `readChangeReadiness`
  lists worktrees with `listChangeWorktrees`. That function pairs a
  worktree with a change when the worktree is not the main one and its
  branch is a valid change name; ADR 0022 names the branch after the
  change. For each active change, readiness reads the lease holder of the
  paired worktree, and calls the change `running` only when a holder
  exists.
- **The running state and its readers.** The state is
  `{ state: "running"; worktreePath; holder }`. `PipelineView` reads
  `holder.author` for its "git author" line, and `ready` prints the
  directory.
- **Status records.** Records live in the directory
  `agentStatusDirectory(root, mainPath)` names. `readAgentStatuses` reads
  that directory and marks a record past the staleness window as `gone`.
  Every record carries `changeName` and `workingDirectory`.
- **The survey.** `surveyWorktrees` reads the changes of every working
  directory, and draws each directory's changes on their own (ADR 0026).

## Decisions

### A live record makes its change running, from this checkout or from the change's own worktree

A record makes a change running when all three hold:

- the record is not gone;
- it names the change;
- its working directory is either this checkout or the worktree that
  `listChangeWorktrees` pairs with the change.

Rejected alternatives:

- **This checkout's lease, for a change that has no worktree.** A lease
  says that a directory is held, not which change is being run in it. Two
  active changes in one checkout would both read as running.
- **A record that names the change from any directory.** Under ADR 0026, a
  copy of the change in an unrelated directory is a different change. A
  run there would mark this one running while nothing touches it.

### The lease names who; a record alone names only where

`holder` becomes optional, and `reportedBy { instanceId, workingDirectory }`
is added.

Rejected alternatives:

- **A new state, such as "reported".** Readiness answers whether a change
  can start, and a change that a run is working on cannot. Two words for
  one answer invite surfaces to treat them differently.
- **Filling `holder` from the record.** A record carries no host, no pid
  and no author. A holder built without them would claim an identity that
  nobody established.

### Records are read without any git of their own

The status directory comes from the main working directory that
`listChangeWorktrees` already listed.

Rejected alternative:

- **`resolveAgentStatusDirectory`.** It lists the worktrees again.

### An unreadable status directory changes nothing

If the directory cannot be read, readiness reports exactly what it reports
today. A diagnostic about runs must never make a readiness report fail.
Writing a record already follows this rule in `startAgentStatusWriter`.

### A worktree says whose it is

`SurveyedDirectory.belongsTo` names the change a worktree belongs to,
under the pairing rule `listChangeWorktrees` applies, and only when that
change is active in the main working directory. Both functions call one
function that states the rule. The view skips that change inside that
directory, and says the directory belongs to the change drawn above.

Rejected alternatives:

- **Matching paths in the view.** Path comparison depends on the platform
  (letter case, separators). The survey already compares paths in Node,
  with `pathKey`.
- **Leaving the directory out of the survey.** Its branch, its runs and
  the other changes it inherited are still worth showing.

## Non-Goals

- Progress, the task in hand or the last run on a card.
- Detecting a run this product did not start. Such a run writes no
  record, and ADR 0026 does not call a directory without one idle.
- Changing when a lease is taken.

## Risks / Trade-offs

- **A record is the run's own claim (ADR 0028).** A run that names the
  wrong change makes that change read as running. The record's directory
  must still be this checkout or the change's own worktree, which limits
  the error to changes that directory holds.
- **A crashed run's record lingers.** After a run dies, its change keeps
  reading as running for up to the staleness window, 20 seconds. A lease
  lingers for the same window.
- **Readiness reads one more directory on every call.** These are file
  reads, and no subprocess.
