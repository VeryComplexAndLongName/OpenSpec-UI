## Context

A change's standing is one reading, `readChangeStandings`. It surveys every
working directory, lists refs, reads the main branch and each change's own
branch, fetches where refs are old, and asks `gh` for pull requests. Its runs
come from the survey it takes first: `copyOf` gives each copy
`standingRunsOf(directory.runs, changeName)`.

Three surfaces draw the word from it:

- **The editor's Changes tree** (`ChangesTreeProvider`) reads standings on
  the `openspec/**` watcher, on Refresh, and every
  `STANDING_FETCH_INTERVAL_MS` (five minutes) while the view is visible. It
  describes each standing with `describeChangeState({ standing })` and keeps
  only the words.
- **The standalone Changes list** reads standings in `loadOverviewFor` and on
  Refresh.
- **A Pipeline card** also reads standings, on the survey's interval. Since
  `the-pipeline-answers-while-a-run-works` 6.3 it lays the survey's runs over
  them (`withSurveyedRuns` in `change-card.ts`), because the standings
  reading is slower and was a reading behind.

A run's status record lives in `agentStatusDirectory(worktreeRoot,
repositoryRoot)`, which is outside the workspace by default. `withAgentStatus`
writes it when a plan, implement, review, verify or chain run starts, renews
it every `AGENT_STATUS_RENEW_INTERVAL_MS` (five seconds), and removes it when
the run ends. The editor's Pipeline panel already watches that directory
(`PipelinePanel.startWatching`), resolved by `resolveAgentStatusDirectory`.

`refreshSurveyRuns(survey)` reads the records again and lays them over a
survey taken earlier, without git. The Pipeline panel uses it for the same
reason this change needs it.

## Goals / Non-Goals

**Goals:**

- The tree says Running within a few seconds of a run's record being written,
  and stops saying it within a few seconds of the record going.
- Neither costs a git command, a fetch or a `gh` call.
- The standalone list says Running within one survey interval.

**Non-Goals:**

- **Passing readiness to the tree.** A run's record is written when it starts,
  so the lease adds nothing the record does not already say. Readiness costs
  git per worktree.
- **Stating the last run's ending in the tree.** Failed and Stopped come from
  the last-runs reading, which the tree does not take today. A separate
  question.
- **Pushing record events to the standalone shell.** The server has no
  channel for it, and the Pipeline tab polls the same survey already.
- **Making the standings reading itself cheaper.**

## Decisions

### The tree keeps the survey its standings reading took

`readChangeStandings` accepts a `survey` option. The tree's production reader
passes one that calls `surveyWorktrees` and keeps its answer. The tree then
holds the last survey and the last standings, not only the words.

Rejected: surveying again on a record event. That lists git worktrees every
five seconds while a run lives, in the process that may be running the chain.

Rejected: adding the survey to `ChangeStandings`. That changes a reading the
server sends to the browser, for a need only the editor has.

### A record event re-reads the runs, and redraws only what changed

`ChangesTreeProvider.refreshRuns()` calls `refreshSurveyRuns` on the held
survey, lays its runs over each held standing with `withSurveyedRuns`, and
describes each again. It fires `onDidChangeTreeData` and updates the
decorations only when a word, colour or badge differs from the held one.
With nothing held yet, it does what `refresh()` does.

Records are not swept on this path. Sweeping is the Pipeline's and the CLI's
business, and a tree reading should not remove files.

### The watcher follows the view's visibility

`extension.ts` already starts the standing timer when the Changes view
becomes visible and stops it when the view is hidden. The records watcher
follows the same switch. Its events are gathered for one second, so a burst
of renewals from several runs becomes one re-read.

Both move into `changes-view-follower.ts`. No test covers the timer where it
lives today, inside `activate`, and the watcher's gathering and disposal need
one.

Where `resolveAgentStatusDirectory` fails, no watcher is made. The tree keeps
its other triggers, as the Pipeline panel does.

### The standalone list re-reads the survey on the Pipeline's interval

While the summary tab, where the Changes list is, is active and standings are
held, `useStandingStates` in `standing-states.ts` reads the Pipeline's survey
reader at once and then every `SURVEY_POLL_INTERVAL_MS`. The list's states
come from `describeChangeState({ standing: withSurveyedRuns(standing,
survey) })`. A survey that fails leaves the words as they were.

A survey asked for before the standings were read is not laid over them:
the standings' own runs are as fresh, and a Refresh would otherwise be
undone by an older survey landing after it. The comparison is between the
browser's clock and the server's, which on the local server are one
machine's.

Rejected: reading standings on that interval. That is the slow reading, with
`gh` in it, every thirty seconds.

### One function, moved to where the browser can import it

`withSurveyedRuns` moves from `change-card.ts` to `worktree-survey-facts.ts`,
beside `standingRunsOf`. That module is already browser-safe, and the survey's
shape lives there. `change-card.ts` imports it back, so a card, the tree and
the list cannot lay runs over standings three different ways.

## Risks / Trade-offs

- **A held survey grows old.** A worktree added since the last standings
  reading is not in it, so a run in that worktree is missed. That lasts until
  the next `openspec/**` event, Refresh or timer, which is today's behaviour
  for everything else about that worktree.
- **The status directory can be busy.** Several runs renew every five
  seconds. The one-second gathering bounds the re-reads to one a second at
  most, and each is a directory listing and small file reads.
- **The standalone list can be up to thirty seconds late.** It was
  indefinitely late before; the Pipeline tab keeps the same interval.
