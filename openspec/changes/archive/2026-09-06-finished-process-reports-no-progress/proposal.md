## Why

The Processes view in VS Code shows finished runs as still working:

```
archive   usage-from-acp · completed · Running
```

The record behind it says both things at once — `state: "completed"`,
`finishedAt: "2026-09-06T04:07:09.473Z"`, and `progress: "Running"`.

This is not one stuck row. **45 of the 100 records in this workspace's
journal are terminal and still carry a `progress` value; 38 of them say
literally `"Running"`.** It is the normal outcome, and it has been
invisible only because nobody looked at the column.

Three things combine:

- `implementation-sessions.ts` calls `report("Running")` once before
  executing and never again. While the process runs, `state` already says
  `running`, so the value adds nothing; once the process finishes, it is
  simply false.
- `ProcessScheduler.finish()` sets `state` and `finishedAt` and leaves
  `progress` untouched, so the last thing reported stays attached
  forever. The neighbouring `waitingFor` field is documented as "set by
  `suspend()` and cleared by `resumeProcess()`" — that discipline exists
  in this file and `progress` was never given it.
- `ProcessTreeItem` joins `state` and `progress` into one description
  line without asking whether the process is still running.

One value in that column is not junk. A run that had to take the
workspace lease from a dead holder records it there — "Reclaimed the
workspace lease from VS Code extension on HPP-NTB63 (pid 29112), which
stopped renewing it 2194s ago" — and `process.progress` is the **only**
place that fact is surfaced. Clearing the field wholesale would delete
real evidence to fix a cosmetic symptom, so this change does not do that.

## What Changes

- `report("Running")` is removed. It duplicates `state` and is the source
  of 38 of the 45 wrong records.
- A finished process stops presenting live progress: the tree omits it
  from the description once the state is terminal, and keeps it in the
  tooltip, where the lease-reclamation note stays reachable.
- Journal load drops the obsolete `"Running"` marker from terminal
  records, so the 45 already written stop contradicting themselves. Only
  that exact value, only on terminal records — every other progress
  string is left alone, because the ones that are not this marker are
  statements about what happened.

## Capabilities

### Modified Capabilities

- `persistent-workbench-runs`: a finished run does not report what it is
  doing, in the record or on any surface.

## Impact

- `packages/core/src/process-scheduler.ts` is unchanged; the fix is in
  `packages/extension/src/implementation-sessions.ts`,
  `packages/extension/src/tree/processes-tree.ts`, and
  `packages/core/src/workbench-run-journal.ts`. Changeset needed:
  `core` and the extension both change observable behaviour.

## Explicitly out of scope

- **Clearing `progress` in `finish()`.** It is the tidy-looking fix and
  it destroys the lease-reclamation evidence, which nothing else records.
  Correcting where that note lives is a real change and needs its own
  proposal, not a side effect of this one.
- **A journal version bump.** The version is already 3 and the cleanup is
  a value-level correction applied on load, not a shape change. Bumping
  would force every older reader to fail closed over a string.
- **The standalone Processes view.** `ProcessesView.tsx` renders `state`,
  `waitingFor` and cost, and never read `progress` — so it never showed
  this. Nothing to change there, stated so the next reader does not go
  looking.
