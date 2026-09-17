The editor's Changes tree and the standalone Changes list say Running while a
run works. Raised by the owner on 2026-09-17, from the live check of
`the-pipeline-answers-while-a-run-works`, where the tree said Ready for the
whole of a chain's `apply`.

## 1. One function lays runs over standings

- [ ] 1.1 Move `withSurveyedRuns(standing, survey)` from
  `packages/core/src/change-card.ts` to
  `packages/core/src/worktree-survey-facts.ts`, beside `standingRunsOf`, and
  export it. `change-card.ts` imports it; its behaviour does not change.
- [ ] 1.2 Move its two tests from `change-card.test.ts` to a new
  `packages/core/src/worktree-survey-facts.test.ts`, calling it directly:
  this checkout's copy takes the runs of the survey's own directory, whatever
  its path is spelled as; a copy elsewhere takes the runs of the directory
  with its path; a copy the survey does not list keeps its runs. Keep one
  test in `change-card.test.ts` that a card still says Running over a
  standing read before the run.

## 2. The editor's Changes tree re-reads the runs

- [ ] 2.1 `readStatesFromCore` in `packages/extension/src/tree/changes-tree.ts`
  passes `readChangeStandings` a `survey` option that calls
  `surveyWorktrees` and keeps its answer. The provider holds the last survey
  and the last `ChangeStandings`, as well as the words.
- [ ] 2.2 `ChangesTreeProvider.refreshRuns()` reads `refreshSurveyRuns` over
  the held survey, without sweeping. It lays those runs over each held
  standing with `withSurveyedRuns` and describes each with
  `describeChangeState`. It fires `onDidChangeTreeData` and updates the
  decorations only where a word, colour or badge differs from the one held.
  With no survey held, it does what `refresh()` does.
- [ ] 2.3 `ChangesTreeOptions` gains a test seam for the runs re-read, as
  `readStates` is one for the standings reading.
- [ ] 2.4 A new `packages/extension/src/tree/changes-view-follower.ts` takes
  over what `extension.ts` does today when the Changes view's visibility
  changes. While the view is visible it keeps the standing timer, and a file
  system watcher on `*.json` in the directory
  `resolveAgentStatusDirectory(workspaceRoot)` answers. The watcher's events
  are gathered for one second and then call `refreshRuns()`, so a burst
  makes one call. Both are disposed when the view is hidden. Where the
  directory cannot be resolved, no watcher is made. `extension.ts` calls it
  in place of its own timer code.
- [ ] 2.5 `packages/extension/src/tree/changes-tree-standing.test.ts`:
  - `refreshRuns` after a record appears turns Ready into Running without
    reading standings again;
  - `refreshRuns` with the same runs fires no tree change;
  - `refreshRuns` after the record goes turns Running back into the
    standing's own word;
  - `refreshRuns` with nothing held reads standings.
- [ ] 2.6 A new `packages/extension/src/tree/changes-view-follower.test.ts`,
  with the vscode mock and fake timers:
  - the watcher is created on the resolved directory when the view becomes
    visible, and disposed with the timer when it is hidden;
  - three events within a second make one `refreshRuns` call;
  - a directory that cannot be resolved makes no watcher and keeps the
    timer.

## 3. The standalone Changes list re-reads the runs

- [ ] 3.1 `packages/webui/src/standalone-entry.tsx`: while the Changes tab is
  active and standings are held, read `loadWorktreeSurvey` every
  `SURVEY_POLL_INTERVAL_MS`. The list's states are
  `describeChangeState({ standing: withSurveyedRuns(standing, survey) })`.
  A failed survey leaves the last states. The Refresh button and
  `loadOverviewFor` are unchanged.
- [ ] 3.2 A test in `packages/webui/src/components/ChangesList.standing.test.tsx`,
  or beside the code that polls: an entry reads Ready, a later survey with
  a run on its change makes it read Running, and no standings reading is made
  for it. A failed survey leaves Running where it was.

## 4. Checks

- [ ] 4.1 `openspec validate the-changes-views-see-a-run-start --strict`
  passes.
- [ ] 4.2 `npm run verify` passes, run unpiped. Record each package's count.
  Do not pipe it: a pipe reports the pipe's exit code.
- [ ] 4.3 A changeset, written with the implementation: `@openspec-ui/core`
  patch, `@openspec-ui/webui` patch, `openspec-ui-vscode` patch.
- [ ] 4.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.
- [ ] 4.5 The whole standalone browser suite passes. Record the spec count.
- [ ] 4.6 **Delegated to claude-cli.** Live, in the Extension Development Host,
  with the Changes view visible: start a harness chain on a change whose
  first task takes longer than a minute. Record the item's description
  before the start, within ten seconds of the run's record appearing, and
  within ten seconds of the chain being stopped from its card. Record also
  whether any git process was started by the extension host between those
  readings, other than the chain's own.
- [ ] 4.7 **Human-only.** Whether the Changes tree now follows a run the
  owner starts, without a Refresh.
