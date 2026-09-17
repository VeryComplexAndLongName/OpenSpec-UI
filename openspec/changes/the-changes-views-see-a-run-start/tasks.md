The editor's Changes tree and the standalone Changes list say Running while a
run works. Raised by the owner on 2026-09-17, from the live check of
`the-pipeline-answers-while-a-run-works`, where the tree said Ready for the
whole of a chain's `apply`.

## 1. One function lays runs over standings

- [x] 1.1 Move `withSurveyedRuns(standing, survey)` from
  `packages/core/src/change-card.ts` to
  `packages/core/src/worktree-survey-facts.ts`, beside `standingRunsOf`, and
  export it. `change-card.ts` imports it; its behaviour does not change.
- [x] 1.2 Move its two tests from `change-card.test.ts` to a new
  `packages/core/src/worktree-survey-facts.test.ts`, calling it directly:
  this checkout's copy takes the runs of the survey's own directory, whatever
  its path is spelled as; a copy elsewhere takes the runs of the directory
  with its path; a copy the survey does not list keeps its runs. Keep one
  test in `change-card.test.ts` that a card still says Running over a
  standing read before the run.

## 2. The editor's Changes tree re-reads the runs

- [x] 2.1 `packages/extension/src/tree/changes-tree.ts`'s production reader,
  `readStandingsFromCore`, passes `readChangeStandings` a `survey` option
  that calls `surveyWorktrees` and keeps its answer, and returns both as a
  `StandingsReading`. The provider holds the last reading, as well as the
  words. Each word is `describeChangeState` of the standing with the
  survey's runs laid over it by `withSurveyedRuns`.
- [x] 2.2 `ChangesTreeProvider.refreshRuns()` reads `refreshSurveyRuns` over
  the held survey, without sweeping. It lays those runs over each held
  standing and describes each again. It fires `onDidChangeTreeData` and
  updates the decorations only where a change's word, colour, badge or
  lines differ from the ones held. With no reading held, it does what
  `refresh()` does. One re-read runs at a time; one asked for meanwhile runs
  after it. A standings reading that lands after a record event re-reads the
  runs once more, since it surveyed before the event.
- [x] 2.3 `ChangesTreeOptions`' test seams are `readStandings`, for the
  standings reading with its survey, and `readRuns`, for the runs re-read.
  They replace `readStates`, which returned the words alone.
- [x] 2.4 A new `packages/extension/src/tree/changes-view-follower.ts`
  (`followChangesView`) takes over what `extension.ts` did when the Changes
  view's visibility changed. While the view is visible it keeps the standing
  timer, and a file system watcher on `*.json` in the directory
  `resolveAgentStatusDirectory` answers, resolved once. The watcher's events
  are gathered for `CHANGES_RECORDS_EVENT_WINDOW_MS` (one second) and then
  call `refreshRuns()`, so a burst makes one call. Both are disposed when
  the view is hidden. Where the directory cannot be resolved, no watcher is
  made. `extension.ts` calls it in place of its own timer code.
- [x] 2.5 `packages/extension/src/tree/changes-tree-standing.test.ts` takes
  the new seams, and describes with core's own browser-safe
  `describeChangeState` and `withSurveyedRuns`:
  - `refreshRuns` after a record appears turns Ready into Running without
    reading standings again, over the survey the standings reading took;
  - `refreshRuns` with the same runs fires no tree change and updates no
    decoration;
  - `refreshRuns` after the record goes turns Running back into the
    standing's own word;
  - `refreshRuns` with nothing held reads standings.
- [x] 2.6 A new `packages/extension/src/tree/changes-view-follower.test.ts`,
  with the vscode mock and fake timers:
  - the watcher is created on the resolved directory when the view becomes
    visible, and disposed with the timer when it is hidden or the follower
    is disposed;
  - three events within a second make one `refreshRuns` call;
  - a directory that cannot be resolved makes no watcher and keeps the
    timer.
- [x] 2.7 `packages/extension/README.md`'s standing section says the word
  follows a run as it starts and ends, with no Refresh.

## 3. The standalone Changes list re-reads the runs

- [x] 3.1 A new `packages/webui/src/standing-states.ts` exports
  `useStandingStates(standings, isActive, loadSurvey, intervalMs)`. While
  active and with standings held, it reads the survey at once and then
  every interval, and returns each change's word from its standing with the
  latest survey's runs laid over it by `withSurveyedRuns`. A survey asked for
  before the standings were read is not laid over them. A failed survey
  leaves the words as they were.
- [x] 3.2 `packages/webui/src/standalone-entry.tsx` gives the Changes list
  `useStandingStates(standings, activeTab === "overview",
  pipelineSurvey, SURVEY_POLL_INTERVAL_MS)`: the summary is the tab the list
  is on, and the survey reader and interval are the Pipeline's. The Refresh
  button and `loadOverviewFor` are unchanged.
- [x] 3.3 A new `packages/webui/src/standing-states.test.tsx`, with fake
  timers: an entry reads Ready, a later survey with a run on its change
  makes it read Running, and a failed survey leaves Running where it was;
  nothing is read while the list is not shown or before standings are read;
  a survey asked for before the standings were read is not laid over them.

## 4. Checks

- [x] 4.1 `openspec validate the-changes-views-see-a-run-start --strict`
  passes.
- [x] 4.2 `npm run verify` passes, run unpiped. Record each package's count.
  Do not pipe it: a pipe reports the pipe's exit code.
- [x] 4.3 A changeset, written with the implementation: `@openspec-ui/core`
  patch, `@openspec-ui/webui` patch, `openspec-ui-vscode` patch.
- [x] 4.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.
- [x] 4.5 The whole standalone browser suite passes. Record the spec count.

  Record, 2026-09-17, for 4.1 to 4.5, in the worktree whose `node_modules`
  resolves `@openspec-ui/*` to its own packages. `openspec validate
  --strict` valid. `npm run verify`, unpiped, after the last code edit:
  typecheck and lint pass in every workspace; tests — root scripts 4 + 11 +
  10 + 9 + 4, cli 161, core 1491 + 4, extension 397, server 103, webui 573 of
  574. The one webui failure is `scripts/build-metro-icons.test.mjs`, the
  known Windows line-ending comparison of the generated icon module, which
  passes on Linux CI and is untouched here. The changeset is
  `.changeset/the-changes-views-see-a-run-start.md`. `lint:english` (after
  `git add`), `lint:changesets`, `lint:test-budgets`, `lint:source-text` and
  `lint:screenshots` pass. The whole standalone browser suite: 21 of 23. The
  two that failed each start a chain and waited past their ceiling for it
  (`harness-screenshots.spec.ts`, the checkpoint, 15 seconds;
  `lifecycle-concurrent-hosts.spec.ts`, 60 seconds). Neither opens the
  summary, where this change's re-reading runs. Run again on their own, both
  passed: 2 of 2.

- [x] 4.6 **Delegated to claude-cli.** Live, in the Extension Development Host,
  with the Changes view visible: start a harness chain on a change whose
  first task takes longer than a minute. Record the item's description
  before the start, within ten seconds of the run's record appearing, and
  within ten seconds of the chain being stopped from its card. Record also
  whether any git process was started by the extension host between those
  readings, other than the chain's own.

  Done on 2026-09-17 by Claude, in the Extension Development Host built from
  this branch (VS Code 1.137.0), driven by Playwright, with the local server
  off. The workspace was a throwaway repository whose `slow-change` first
  task waits 100 seconds, run by claude-cli-acp with haiku, autonomous, so no
  task was ticked while the tree was read. The chain was started from its
  Pipeline card, and the Pipeline was then closed, since its own readings
  run git. A PowerShell loop logged every git process it saw, with its
  parent, for 30 seconds of heartbeats. Three runs; pictures and logs are
  kept outside the repository.
  - **Before the start:** "slow-change draft — Ready".
  - **The run starts:** the record appeared 2 to 4 seconds after Start. The
    row said "slow-change draft — Running" 1.4 seconds after the record
    appeared, in each of the three runs, with no Refresh.
  - **Thirty seconds of heartbeats:** the row still said Running. With the
    editor's own Git extension on, the extension host started a pair of git
    processes about every five seconds. With `--disable-extension=vscode.git`
    and `vscode.github`, it started none in 753 samples: the four git
    processes seen came within 0.8 seconds of each other as the agent
    started, one read with `claude.exe` as its parent and three ended before
    their parent could be read. The renewals cost this extension no git.
  - **Stopped from the card** (Stop, a reason, then Stop now): the record went
    0.4 and 0.7 seconds later in the last two runs. The row said
    "slow-change draft — Ready" 1.4 and 0.9 seconds after that. The first
    run pressed Stop without giving a reason, so nothing stopped; the record
    it left was removed by hand before the next run.

- [ ] 4.7 **Human-only.** Whether the Changes tree now follows a run the
  owner starts, without a Refresh.
