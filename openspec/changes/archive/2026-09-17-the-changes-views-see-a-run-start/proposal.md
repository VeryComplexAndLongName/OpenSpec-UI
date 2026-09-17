## Why

While a harness chain ran on a change, the editor's Changes tree said
`slow-change draft — Ready` for the whole run, with the optional local
server on and with it off. The Pipeline card for the same change said
Running. Seen on 2026-09-17 in the live check of
`the-pipeline-answers-while-a-run-works` (its tasks 5.6), over more than a
minute of `apply`.

Both surfaces take the word from `describeChangeState`. The difference is
when they read the facts it is given:

- **The Changes tree reads standings only on three triggers.** They are an
  event from the `openspec/**` watcher, the view's Refresh, and a
  five-minute timer while the view is visible (`extension.ts`).
- **A run writes its status record outside the workspace.** The record goes
  to `<worktree root>/<repository>/.agent-status/*.json`, which by default is
  beside the repository, not in it. The run writes nothing under
  `openspec/` until it ticks a task.

So nothing asks the tree to read again when a run starts. The tree says
Ready until the first ticked task, a Refresh, or the timer. It goes on saying
Running after a run that ticked nothing has stopped. A Pipeline card does
not have this problem: the panel watches the status records, and polls
them as a backstop.

The standalone shell's Changes list is staler still. It reads standings when
the workspace loads and on Refresh, and at no other time.

## What Changes

- **The editor's Changes tree watches the run status records.** While the
  Changes view is visible, a record being written, renewed or removed makes
  the tree read the runs again.
- **That re-read touches the records only.** The tree keeps the survey its
  last standings reading took. On a record event it reads the records again
  over that survey (`refreshSurveyRuns`, which runs no git) and lays the runs
  over the standings it holds. It fetches no refs and asks `gh` nothing. An
  item is drawn again only when its word changed, so the heartbeat that
  rewrites a record every five seconds costs file reads and redraws nothing.
- **The standalone Changes list reads the runs again while it is shown.** It
  reads the working-directory survey on the Pipeline's survey interval and
  lays those runs over the standings it holds. It does not read standings
  again.
- **One function lays runs over standings, everywhere.** Today it is private
  to `change-card.ts` (`withSurveyedRuns`, added by
  `the-pipeline-answers-while-a-run-works` 6.3). It moves beside
  `standingRunsOf` and is exported, so the card, the tree and the list lay
  runs over standings the same way.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vscode-extension`: when the Changes tree reads a change's standing again.
- `shared-ui`: when the Changes list reads which runs are live again.

## Impact

- **`packages/core`**: `withSurveyedRuns` moves from `src/change-card.ts` to
  `src/worktree-survey-facts.ts` and is exported. Tests move with it.
- **`packages/extension`**: `src/tree/changes-tree.ts` (keeping the survey
  and standings it read, and re-reading the runs alone), a new
  `src/tree/changes-view-follower.ts` (the standing timer and a watcher on
  the status directory while the Changes view is visible, moved out of
  `src/extension.ts`), and their tests.
- **`packages/webui`**: a new `src/standing-states.ts` (re-reading the survey
  while the summary, where the Changes list is, is shown), its use in
  `src/standalone-entry.tsx`, and a test.
- **`packages/extension/README.md`**: the standing word follows a run.
- **Unchanged**: the standings reading and its shape, the server's routes,
  the fetch interval, and the Refresh commands.
