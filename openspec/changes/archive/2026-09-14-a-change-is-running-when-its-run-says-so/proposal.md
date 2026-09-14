# A change is running when its run says so, and is drawn once

## Why

ADR 0029 decides two things about how a change is shown:

- a change is one card, wherever it is being worked;
- a run's status record, and not only a lease, makes that card say the
  change is running.

Readiness gets both wrong today, and the Pipeline and
`openspec-ui-cli ready` repeat what it says.

- **Only a lease on the change's own worktree makes a change running.**
  `readChangeReadiness` reads the lease of the worktree that
  `listChangeWorktrees` pairs with a change, and nothing else. A chain
  started in this checkout holds this checkout's lease, which readiness
  never reads for a change. The change that chain runs therefore reads
  "ready": it is offered as startable, and a hint can suggest starting it
  alongside another change.
- **A run that holds no lease never shows as running.** A delegated
  item's run takes no lease. Its status record names the change and the
  directory, but readiness never reads status records.
- **A change with its own worktree is drawn twice.** Its card here comes
  from this checkout's report. The worktree's copy, where its tasks are
  ticked, is drawn again under "Other working directories", as though it
  were somebody else's change.

## Capabilities

### New

- Readiness reads the runs' status records. A live record that names a
  change makes that change running, naming the directory, when the record
  comes from this checkout or from the change's own worktree.
- A surveyed directory says which change it belongs to, when it is that
  change's own worktree.

### Modified

- The running state takes who is running from the lease, where there is
  one. Where only a record says so, it claims nothing about who.
- The Pipeline does not draw a change a second time inside the change's own
  worktree, and says that the worktree belongs to that change.
- `openspec-ui-cli ready` reports a change as running when its run says
  so.

## Impact

- `packages/core`: `change-readiness.ts` and its facts, `change-worktrees.ts`,
  and `worktree-survey.ts` and its facts.
- `packages/cli`: the output of `ready-command.ts` for a running change
  that has no lease holder.
- `packages/webui`: `PipelineView`, both the local card of a running change
  and the section for a worktree.
- No git runs beyond the worktree list readiness already makes.

## Out of scope

- Anything a card says beyond its state and where the change runs:
  progress, the task in hand, the last run. Those belong to
  `a-card-says-what-its-change-is-doing`.
- A copy of the change in any directory other than this checkout and the
  change's own worktree. That copy stays a separate change (ADR 0026).
