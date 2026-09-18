## Context

`describeChangeState(facts)` in `packages/core/src/change-state-word.ts`
builds a list of candidate words and takes the first; the rest become the
lines beneath it. Its tail reads:

```ts
if (counts !== undefined && counts.total > 0 && counts.done === counts.total) {
  found.push({ key: "done", word: "Done", ... });
} else if (facts.readiness === "blocked") {
  found.push({ key: "blocked", word: "Blocked", ... });
} else {
  found.push({ key: "ready", word: "Ready", ... });
}
```

`facts.readiness` is optional. Of the five callers, one passes it —
`packages/cli/src/ready-command.ts`. The standalone Changes list
(`standing-states.ts`) and the editor's Changes tree (`changes-tree.ts`)
do not, and neither does the run dialog's standing in either host.

The fact itself is already read, by `readChangeReadiness`: it keeps a
change's `blocked_by` entries that are still active and reports
`run.state === "blocked"` with `blockedBy`. The Pipeline reads it; the
Changes views read standings and a worktree survey instead.

## Goals / Non-Goals

**Goals:**

- The Changes views and the Change Graph never disagree about one change.
- Blocked says what blocks it, by name.
- A change that is done and blocked states both facts.

**Non-Goals:**

- **Changing what `blocked_by` means**, or when a blocker is satisfied.
  `change-readiness.ts` and `change-graph.ts` are untouched.
- **A new reading in the hosts' hot path.** The readiness reading is the
  one the Pipeline already makes; the views take what is read rather than
  reading a second time.
- **The run dialog's standing.** It names one change the person already
  chose; blocking is a list-level question, and widening the dialog is its
  own change.

## Decisions

### The views pass what core needs, rather than core guessing

`describeChangeState` keeps `readiness` optional — a caller that genuinely
has no reading should not be forced to invent one — and the two Changes
views start passing it. This keeps the fix where the omission was.

**Rejected: making core read readiness itself inside
`describeChangeState`.** It is a pure function over facts, and the Pipeline
already hands it facts read once for a whole workspace; a reading inside it
would run per change and per render.

### Blocked carries its blockers, and stands beside Done

The word becomes `Blocked by <name>` for one blocker and
`Blocked by <name> and N more` beyond that, from the same `blockedBy` the
readiness fact carries. A list that says only "Blocked" sends the reader to
the graph to learn what by, which is the trip DW made.

Where every task is ticked and a blocker is still active, Done stays the
chosen word — the closed set's existing scenario says a change whose tasks
are all ticked says Done — and Blocked is pushed as a further candidate, so
it appears as a line beneath. Both facts are true and the reader sees both.

**Rejected: letting Blocked outrank Done.** The scenario in `shared-ui`
already pins Done for a change with every task ticked, and this change is a
defect fix, not a rewrite of the closed set's order.

### One test reads both surfaces from one workspace

The regression test builds a workspace where `a` declares `blocked_by: b`
with `b` still active, then asserts that the Changes views' word and the
graph's edge agree. It fails against today's code, which is the point: the
defect was two readings of one workspace that nobody compared.

## Risks / Trade-offs

- **A reading the views did not make before.** The standalone list takes
  the readiness the shell already loads for the Pipeline, and the editor's
  tree reads it with its standings, on the same interval. Measured on this
  repository, a readiness reading of 264 changes is part of the Pipeline's
  own reading and is not a new walk.
- **A word that grows.** "Blocked by apply-plan-stays-pending" is longer
  than "Ready" in a tree row; the rows already truncate, and the blockers
  are also in the lines beneath.
- **Two hosts, one rule.** Both take the same core function and the same
  fact, so neither can drift; the test reads both.

## Protocol

No command, event or route changes.
