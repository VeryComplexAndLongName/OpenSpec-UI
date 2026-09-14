One card per change, derived in core from the readings the hosts already
take, with the chain's ending recorded so a card can say how the last run
ended (ADR 0029).

## 1. What the survey carries for a card

- [x] 1.1 `SurveyedChange` in `packages/core/src/worktree-survey-facts.ts`
  gains four fields:
  - `tasksForPerson`: the number of open Human-only items;
  - `tasksDelegated`: the number of open delegated items;
  - `nextOpenTask?: { number: string; text: string }`: the first open item
    that is neither Human-only nor delegated, numbered by `taskNumberOf`;
  - `tasksModifiedAt?: string`: the task list's modification time.

  `surveyChanges` in `worktree-survey.ts` fills them from the items it
  already reads, plus one `stat` per list.

  Done: `cardFactsOf` in `worktree-survey.ts` counts from the parsed items
  and takes the first open plain item's number and text, with the leading
  number stripped. The mtime comes from one `stat`. It is spread in only
  when the change has a task list.
- [x] 1.2 core `worktree-survey.test.ts`:
  - the two counts;
  - the first open task skips a Human-only item and a delegated item;
  - a change with no task list carries none of the four fields.

  Done: the describe "what the survey carries for a card" has two tests.
  One covers the counts and the skip; the other a change with no task
  list. The file passes, 26 tests.

## 2. A chain writes its own ending

- [x] 2.1 In `packages/core/src/audit-runs.ts`, add
  `CHAIN_ENDING_AGENT_NAME = "chain"` beside `VERIFY_CHECKS_AGENT_NAME`,
  and make `isRunEntry` return `false` for it as well. Its comment says why:
  like the checks entry, it has one terminal entry and no `started`
  partner.

  Done: both the constant's comment and `isRunEntry`'s say so.
- [x] 2.2 `HarnessChainRunner` in `packages/core/src/harness-chain-runner.ts`
  writes exactly one audit entry for each chain run, as the chain ends. The
  entry has:
  - `agent: CHAIN_ENDING_AGENT_NAME`;
  - the chain's `runId`;
  - `outcome`;
  - the `stage` the chain ended at;
  - `reason`, where the ending has one;
  - `changeDir`;
  - no `usage`.

  It is written for each of these endings:
  - completed;
  - failed;
  - cancelled while a stage runs;
  - cancelled while waiting at a checkpoint;
  - stopped by the run-time limit;
  - stopped by the attempt limit.

  Done: `run()` reads the chain's own events as they pass: the last
  `stageStarted` and the terminal `completed`, `failed` or `cancelled`.
  In its `finally` block it records one entry through `recordEnding`, so
  every place that yields an ending is covered without being touched. A
  declared step's name is not an audit stage and is left out. The entry
  has `reason` only when the ending carried one, and never `usage`.
- [x] 2.3 Check each reader that totals the log, and record the check:
  - `buildChangeCostReport` and `buildWorkspaceRunStats` skip the entry
    through `isRunEntry`;
  - `runTimestampsByChange` counts no run for it;
  - the quality readback in `verify-quality.ts` counts no run and no spend
    for it.

  Do not add a second filter beside `isRunEntry`.

  Checked 2026-09-14:
  - `buildChangeCostReport` and `buildWorkspaceRunStats` drop the entry at
    their existing `isRunEntry` call. No second filter was added.
  - `runTimestampsByChange` counts no runs. It collects dates of work, and
    it keeps every entry with a `changeDir`, the checks entry included. The
    ending adds its timestamp, the moment the chain's last stage ended, so
    it adds no day the chain's own stage entries did not already give.
  - `verify-quality.ts` groups only entries with `checksRan`, and the
    ending has none, so it adds no run and no spend.
- [x] 2.4 core tests:
  - `harness-chain-runner.test.ts`: one ending entry for each of the six
    endings, with its stage and reason;
  - `change-cost-report.test.ts` and `workspace-run-stats.test.ts`: a log
    containing a chain ending gives the same rows and totals as the same
    log without it.

  Done:
  - `harness-chain-runner.test.ts`: "a chain writes its own ending", six
    tests. Completed at archive with no reason; failed at apply with the
    agent's reason; cancelled mid-stage at propose with no reason;
    cancelled at a checkpoint; the run-time limit, whose reason names
    `maxRunSeconds is 1s`; the attempt limit, whose reason names
    `maxStageAttempts: 2`. The file passes, 95 tests.
  - `change-cost-report.test.ts`: the report with and without the ending is
    deeply equal.
  - `workspace-run-stats.test.ts`: every figure is equal except
    `entriesRead`, which counts entries before any exclusion by definition
    and grows by one.

## 3. How the last run ended

- [x] 3.1 `packages/core/src/last-runs-facts.ts` uses no Node imports and is
  exported from `browser.ts`. It defines:
  - `LastRun { runId: string; outcome: "completed" | "failed" | "cancelled"; stage?: string; endedAt: string; reason?: string; costUsd?: number }`
  - `LastRunsReport { byChange: Record<string, LastRun> }`

  Done. `browser.ts` also exports `CHAIN_ENDING_AGENT_NAME` beside
  `VERIFY_CHECKS_AGENT_NAME`.
- [x] 3.2 `readLastRuns({ workspaceRoot, git? }): Promise<LastRunsReport>`
  in `packages/core/src/last-runs.ts`:
  - reads `readRepositoryAuditEntries`;
  - keeps entries that pass `isRunEntry`, together with chain ending
    entries;
  - groups the entries by `runId`, and keys each run by
    `changeNameOf(changeDir)`.

  For each change it reports the latest run that has ended:
  - **ending:** from the chain ending entry where there is one, and
    otherwise from the run's last terminal entry;
  - **stage:** from that entry, and otherwise from the run's last entry that
    has a stage;
  - **`endedAt`:** that entry's timestamp;
  - **`costUsd`:** the sum of the run's reported `usage.costUsd`, absent when
    no entry reported one.

  A run with no terminal entry is skipped. Export `readLastRuns` from
  `index.ts`.

  Done: `readLastRuns` reads the entries, and `lastRunsOf` gives the same
  answer over entries a caller already has. Without a chain ending, a run
  counts as ended only when its last entry is terminal. A last `started`
  is a stage still going, or one that died without saying. A chain resting
  at a checkpoint after a completed stage therefore reads as that stage's
  completion, and a card shows it as `Waiting` first, by 5.3's precedence.
  The `git` option needs only `worktreeList`.
- [x] 3.3 `readRepositoryAuditEntries` in
  `packages/core/src/repository-audit.ts` accepts an optional cache. With
  one, it parses a file again only when the file's size or modification
  time has changed. `readLastRuns` passes a cache that lives for the whole
  module.

  Done: `AuditReadCache` is keyed by file path. A log that is absent or
  cannot be read drops out of the cache and gives nothing, which is what
  `readEntries` said before. The existing callers pass no cache, and
  `repository-audit.test.ts` still passes, 7 tests.
- [x] 3.4 core `last-runs.test.ts`:
  - a chain that failed at verify;
  - a chain cancelled at a checkpoint, whose ending comes from the chain
    entry;
  - a run found in the log of the change's own worktree;
  - a run with no usage, which has no cost;
  - a started run with no ending, which is skipped in favour of the
    previous run that ended;
  - a log written before chain endings existed, whose ending comes from
    the last terminal entry;
  - two reads of an unchanged file, which parse it once.

  Done: seven tests, one for each case, and the last also checks that a
  log which grew is parsed again. The failed chain's cost is the sum of
  its stages, 0.5 and 0.25. Core typechecks.

## 4. Carried to both hosts

- [x] 4.1 Add `handleChangeLastRunsRequest` to `packages/server/src/rest.ts`,
  routed at `POST /api/change-last-runs` in `server.ts` beside
  `/api/change-readiness`. It answers:
  - 400 when the body has no `cwd`;
  - the same authorization as the readiness route;
  - 200 with `readLastRuns({ workspaceRoot: cwd })`.

  Done: the route is written like the readiness route, with the same body
  check and `authorizeCwd`.
- [x] 4.2 A server route test covers all three answers.

  Done: `server.test.ts` "change last runs", three tests. The 200 case
  reads a real audit log whose chain failed at verify; the others are the
  403 for a cwd outside the workspace and the 400 for a body with no cwd.
  They pass.
- [x] 4.3 Add `packages/webui/src/change-last-runs-client.ts`, shaped like
  `change-readiness-client.ts`.

  Done: `loadChangeLastRuns(request, cwd)`.
- [x] 4.4 The pipeline panel in
  `packages/extension/src/webview/pipeline-panel.ts` answers
  `pipeline/last-runs` with `readLastRuns({ workspaceRoot })`.
  `BridgeOperation` gains `pipeline/last-runs`, and `pipeline-entry.tsx`
  passes it to the view.

  Done: `PipelineReaders.lastRuns`, with a test that it answers against the
  host's own root whatever the message names. `pipeline-panel.test.ts`
  passes, 14 tests, and the extension typechecks.
- [x] 4.5 `PipelineViewProps` gains
  `lastRuns?: () => Promise<LastRunsReport>`. It is read together with the
  survey: on the survey's interval without `subscribe`, and on the survey's
  signal with it. `standalone-entry.tsx` and `pipeline-entry.tsx` both pass
  it.

  Done: `usePolledReading(lastRuns, …, SURVEY_POLL_INTERVAL_MS, { name:
  "survey", subscribe })`, and Refresh reads it again with the others.
  Webui typechecks, and the two PipelineView test files pass, 34 tests.

## 5. The cards

- [x] 5.1 `packages/core/src/change-card.ts` uses no Node imports and is
  exported from `browser.ts`. It exports
  `describeChangeCards({ report, survey, lastRuns, now }): ChangeCard[]`,
  which returns one card per change of the report. Each card holds:
  - `state`: `running`, `waiting`, `failed`, `stopped`, `blocked`, `ready`
    or `done`;
  - `run?`: `stage`, `activity`, `activityAt`, `waiting`, and `task`, whose
    `source` is `agent`, `command` or `guess`;
  - `progress?`: `done`, `total`, `forPerson` and `delegated`;
  - `lastRun?`;
  - `where`: `label`, `path`, `branch?` and `ownWorktree: boolean`.

  Done. `run` also carries `instanceId`, so a run line can leave out the
  run a card shows, and the card keeps `stateFacts`, the facts it asks
  `describeChangeState` about. `describeChangeCards` also takes optional
  `standings`; see 5.5.
- [x] 5.2 A change's facts come from its own worktree when a surveyed
  directory's `belongsTo` names the change, and otherwise from this
  directory's survey entry. Its runs are the surveyed runs of that directory
  whose `changeName` is the change and that are not gone.

  Done: a directory other than this one whose `belongsTo` names the change
  is the source, and otherwise this directory is. Tested with a worktree
  whose counts and run differ from this checkout's. A run of another change
  in the same directory, and a gone run, are not the card's.
- [x] 5.3 `state` follows this precedence. The first match wins:
  1. `waiting`, for a live run whose record is waiting;
  2. `running`, for any other live run, or when readiness says `running` and
     no run is surveyed;
  3. `failed` or `stopped`, when the last run ended `failed` or `cancelled`
     and its `endedAt` is not earlier than `tasksModifiedAt`;
  4. `blocked`;
  5. `done`, when `total > 0` and every task is done;
  6. `ready`.

  Done, in that order. Where a run's own record is surveyed, readiness's
  `running` is not passed to the state word as well. A lease saying
  running would otherwise outrank a record saying the run waits, and the
  word would read `Running` on a waiting card.
- [x] 5.4 The guess: when a live run's record names no task, `task` is the
  survey's `nextOpenTask`, with source `guess`. When no run is live, there is
  no `task`.

  Done: a record's own task wins; otherwise the survey's `nextOpenTask`
  becomes the task, with source `guess`.
- [x] 5.5 `describeChangeCard(card, now)` returns `{ stateWords, lines }`.
  - `stateWords` is the word `describeChangeState` in
    `packages/core/src/change-state.ts` gives for the card's facts; that
    function comes with `a-change-says-where-it-stands`. The card passes
    its readiness and last run into the same facts, and picks no word of
    its own, so a card and the Changes list always say the same word (ADR
    0029's amendment of 2026-09-13). It is plain `Failed` or `Stopped` when
    the run had no stage.
  - `lines` come in this order, and each appears only when there is
    something to say:
    1. **the task:** `on task 2.3: <text>`, followed by `, by its own account`
       or `, the task it was given`; or `probably task 2.4: <text>`;
    2. **the activity or the wait:** the activity with its age, counted from
       `activityAt` and `now`; or `waiting to continue to verify, in <label>`;
    3. **the progress:** `7 of 12 tasks done`, followed by
       `; 2 only a person can close` and `; 1 delegated` where they apply;
    4. **the last run:** `last run failed at apply 2 hours ago, $0.84`, with
       the cost only where one was reported, and with the reason for a run
       stopped with one;
    5. **where:** `in <label>, on branch <branch>`.

  Done.
  - `ChangeStateFacts.lastRun.stage` is now optional, and a run with no
    stage reads plainly `Failed` or `Stopped`.
  - For the word to be the Changes list's, a card asks about the same
    standings. `describeChangeCards` takes the standings a host read. Both
    Pipelines now read them with the survey, fetching only on the fetch
    interval: `standings` on `PipelineViewProps`, the standalone shell's
    `loadChangeStandings`, and the panel's `pipeline/standings`. Without
    them, a card asks about this copy alone.
  - The where line is given only for a card read from the change's own
    worktree. This checkout is already named above the picture.
  - A completed last run reads `last run completed at <stage>`.
  - Ages read `30s ago`, `5 minutes ago`, `2 hours ago` or `1 day ago`.
- [x] 5.6 `LocalPicture` in `packages/webui/src/components/PipelineView.tsx`
  draws each card's state line and detail lines from `describeChangeCard`.
  It keeps the collision lines readiness already gives, and applies the
  existing line budget, so lines past the budget stay available. Do not
  compute any of these words in the view.

  Done: `PipelineView` derives the cards once per render with
  `describeChangeCards`. `Node` draws the card's state word and its lines,
  then readiness's lines (`describeChange`) and `also in`, all through the
  existing `CardDetails` budget. `data-state` is the card's state. The
  view's own `stateWord` switch is gone.
- [x] 5.7 `packages/webui/src/shell-ui.ts` gives the `Waiting`, `Failed at`
  and `Stopped at` state words tokens of their own. Every state is told
  apart by its word; colour agrees with the word and is never the only
  difference.

  Done: `--pipeline-state-ink` colours the state word, and is set per
  state from palette tokens, with no colour literals.
  - `waiting`: primary, with a dashed edge.
  - `failed`: bad on the bad background.
  - `stopped`: bad, with a dotted edge and no background.
  - `done`: a good edge.

  Waiting and running share a hue, and so do failed and stopped. Within
  each pair the word and the edge style differ. `shell-ui.test.ts`, which
  rejects colour literals outside the palette, passes.
- [x] 5.8 The directory's run lines above the picture stay for runs no card
  here shows: a run that names no change, or a run of another directory's
  change. They no longer repeat a run a card already shows.

  Done: `runsShownOnCards(cards)` names the runs the cards show.
  `describeDirectoryRuns` takes that set and leaves those runs out, both
  above the picture and in another directory's section. A directory whose
  every run is on a card says `every run here is on its change's card`
  rather than that no run reports.

## 6. Tests

- [x] 6.1 core `change-card.test.ts`:
  - one input for each precedence case in 5.3;
  - a failure older than the task list;
  - a stop with a reason, and one without;
  - a waiting run;
  - a guess that skips a Human-only item and a delegated item;
  - a change with its own worktree, whose progress and runs come from that
    worktree and whose card names it.

  Done: "the state, first match wins" has a test for each precedence case.
  It adds a waiting run under a lease that says running, a gone run, a
  failure with no stage, a failure older than the task list, and a
  completed last run. "What a card is read from" covers the change's own
  worktree and a run of another change. The skip itself is the survey's,
  already tested in `worktree-survey.test.ts`; here the guess is taken from
  a change that has both a Human-only and a delegated item open.
- [x] 6.2 core `change-card.test.ts`, for `describeChangeCard`:
  - the words for each state and for each line;
  - a cost only where one was reported;
  - ages counted from `now`.

  Done: "the lines" covers the guess, no guess without a live run, the
  task a run was given, a wait, a cost only where reported, a stop with a
  reason and without, ages from two different `now`s, and a card with
  nothing to say. `runsShownOnCards` has two tests. The file passes, 23
  tests.
- [x] 6.3 webui `PipelineView.test.tsx`:
  - a card shows the state words and lines the core function returns;
  - a card with more lines than its budget still carries every line;
  - a run shown on a card is not repeated in the run lines above the
    picture.

  Done: "a card says what its change is doing" has four tests.
  - A failed card, with `Failed at verify`, `data-state="failed"`, and its
    progress and last-run lines.
  - A card with four lines over a two-line budget, which keeps each in its
    text and title.
  - A card whose word is `Archived on main` from the standings.
  - A run shown on a card and left out above, where it reads
    `every run here is on its change's card`.

  The 31 earlier tests pass unchanged; the file has 35.
- [x] 6.4 browser `e2e/pipeline.spec.ts`:
  - a fixture change whose audit log shows its latest chain failing at
    verify shows `Failed at verify`;
  - no drawn line is cut;
  - the tab passes axe at WCAG AA.

  Done: after writing the task lists, `beforeAll` writes the workspace's
  `.openspec-ui/audit.jsonl`. It holds a chain on `pipeline-first` whose
  verify stage failed, with a cost of $0.42, and its `chain` ending entry.
  "draws the declared order, and passes axe" expects that card to read
  `Failed at verify`, to carry `data-state="failed"`, and to show
  `last run failed at verify`. In the same test, the existing check finds
  no drawn line past its card's inner edge, and axe finds no serious or
  critical WCAG 2.1 AA violation. The whole browser suite passed with it
  at `86bfead`, 18 tests (7.4), and so did CI's browser job.

## 7. Verification

- [x] 7.1 This change validates strictly. `check(validate-change)`

  Done: `openspec validate a-card-says-what-its-change-is-doing --strict`
  reports it valid, 2026-09-14.
- [x] 7.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and each package's test count.

  Local run 2026-09-14 at `86bfead`, exit code 1. Typecheck and every lint
  passed. Tests: cli 155 passed; core 1390 passed, 1 failed; extension 358
  passed; server 95 passed; webui 450 passed. The one failure is
  `keeps accepting this repository's real openspec/agent-harness.json`,
  which reads the working tree's file: an uncommitted local edit, not part
  of this change, sets its `autonomyLevel` to `semi-autonomous`. Closed on
  CI: the "Typecheck, lint, test, and build" job of #492 ran
  `npm run verify` at the same commit against the committed tree and
  passed,
  <https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/34802009128/job/103846374816>.
- [x] 7.3 A pending changeset exists, with core, webui, server and the
  extension each at minor. `check(changeset-present)`

  Done: `.changeset/a-card-says-what-its-change-is-doing.md`.
- [x] 7.4 Run the whole browser suite, not a selected spec. Regenerate
  `docs/images/standalone/pipeline.png` and look at it.

  Done 2026-09-14 at `86bfead`: `npm run test:browser -w @openspec-ui/server`
  exited 0, 18 passed (4.5 min). CI's "Standalone browser and
  accessibility" job passed at the same commit. The retaken `pipeline.png`
  was looked at:
  - `pipeline-first`, whose fixture chain failed at verify, reads
    `FAILED AT VERIFY` on a red card with a red edge, then
    `0 of 1 tasks done` and `last run failed at verify 2s ago, $0.42`. A
    `+2` counts its readiness lines past the budget.
  - `pipeline-second` reads `BLOCKED`, `0 of 1 tasks done` and
    `waiting on pipeline-first`.
  - `pipeline-unrelated` reads `READY`, `0 of 1 tasks done` and
    `in pipeline-unrelated, on branch pipeline…`: its own worktree, named
    on the card.
  - No line is cut, and the run line above the picture still says no run
    reports here.

  `diff-preview.png`, `harness-settings.png`, `processes.png` and
  `view-summary.png` were also retaken. They show screens this change does
  not touch, and were restored.
- [x] 7.5 **Delegated to claude-cli**: check a card against a real chain.

  Setup:
  - a scratch git repository outside this one, with one change of three
    tasks;
  - a per-change `harness.json` setting `autonomyLevel` to
    `semi-autonomous`;
  - a stand-in `claude` first on `PATH` which, in the stage that implements,
    prints `Starting task 1.1`, ticks 1.1, waits 20 seconds and exits 1.

  Steps:
  1. Start the standalone server from this branch.
  2. Start the chain from the Change Editor's Run with Agentic Harness, in a
     browser.
  3. Read the change's card at three moments: while the chain waits at its
     first checkpoint, while the stage that ticks runs, and after that stage
     fails.

  Evidence:
  - the card's text at each moment, as the page rendered it, with the
    time;
  - the audit log's chain ending entry;
  - a picture of the card after the failure, looked at.

  Expected: `Waiting`; then `Running` with `on task 1.1`, by its own
  account, and `1 of 3 tasks done`; then `Failed at` the stage, with a
  last-run line.

  Take every step in foreground commands: start the server and the
  browser as child processes of one driver, take the readings while they
  run, and return only once the chain has ended and both have been
  stopped. Nothing may be left running in the background when a command
  returns.

  Done 2026-09-14 (UTC) at `966642e`, Node 22.11.0, Windows 10. One
  foreground Node driver in the session's scratchpad exited 0. It built
  the repository, started the server and a headless Chromium as its own
  children, took the readings, and stopped both before returning.
  `git status` of this repository showed no new files afterwards.

  Setup, and one deviation from it:
  - `npm run build -w @openspec-ui/server` exited 0 first, so the page
    served this branch's webui.
  - `<repo>` is a fresh git repository on `main`, outside this one, with
    one active change, `card-change`, holding tasks 1.1, 1.2 and 1.3.
    `OPENSPEC_UI_WORKTREE_ROOT` pointed at a scratch directory.
  - The change's `harness.json` sets `autonomyLevel: "semi-autonomous"`,
    `stepAgents` apply and verify on `claude-cli`, and
    `maxStageAttempts: 2`.
  - A stand-in `bin\claude.cmd` came first on the server's `PATH`
    (`where claude` resolved to it).
  - Deviation: a change with open tasks starts its chain at `apply`
    (`determineStartStage`), and a checkpoint comes only after a stage;
    a declared step reaches none. So a stage that ticks and fails at once
    never lets the chain wait. The stand-in's first implementing stage
    therefore does nothing and exits 0. Verify then ticks nothing and
    exits 0, and with 3 tasks open and 2 attempts allowed the chain returns
    to `apply` with no further checkpoint. The second implementing stage
    does what this item says: it prints `Starting task 1.1`, ticks 1.1,
    waits 20 seconds and exits 1.
  - The server ran `node --import tsx packages/server/src/cli.ts <repo> 0`
    on 127.0.0.1:53179.

  Steps: one page chose `card-change` in the Change Editor, pressed Run
  with Agentic Harness (the dialog said `autonomyLevel is
  "semi-autonomous", so a chain runs rather than one stage.`), chose the
  chain and pressed Start chain at 03:47:58.002Z. A second page read the
  card on the Pipeline tab, pressing Refresh before each reading, since
  the survey otherwise polls every 30 seconds.

  The card as the page rendered it (`innerText`; `+N` counts lines past
  the budget, each still in the card's text):
  1. At the checkpoint, 03:48:03.847Z, after the editor showed
     `Continue to verify with claude-cli?` at 03:48:02.864Z:
     `data-state="waiting"`, `WAITING FOR YOU`,
     `probably task 1.1: Write the first file`,
     `waiting to continue to verify, in card-repo`, `+3`,
     `0 of 3 tasks done`, `last run completed at apply 0s ago`,
     `in <repo>`.
  2. The checkpoint was confirmed at 03:48:03.989Z. At 03:48:05.125Z
     verify had ended and the second apply had not yet said which task it
     was on: `RUNNING`, `probably task 1.1: Write the first file`,
     `running apply — said 0s ago`, `0 of 3 tasks done`. While the stage
     that ticks ran, at 03:48:07.160Z: `data-state="running"`, `RUNNING`,
     `on task 1.1: Write the first file, by its own account`,
     `running apply — said 0s ago`, `+2`, `1 of 3 tasks done`, `in <repo>`.
  3. After the failure, at 03:48:28.590Z (the editor said
     `Failed: claude exited with code 1`): `data-state="failed"`,
     `FAILED AT APPLY`, `1 of 3 tasks done`,
     `last run failed at apply 1s ago`, `+1`,
     `no working directory of its own — openspec-ui-cli worktree add card-change`.
     There is no cost: the stand-in reported no usage.

  The audit log's chain ending entry, from `<repo>\.openspec-ui\audit.jsonl`:
  `{"runId":"2214442e-d8e5-4a3f-aa77-6a51c80fd50e","agent":"chain","outcome":"failed","cwd":"<repo>","timestamp":"2026-09-14T03:48:26.585Z","changeDir":"<repo>\\openspec\\changes\\card-change","stage":"apply","reason":"claude exited with code 1"}`.
  It is the only `chain` entry. The run's six stage entries under the same
  run id are apply started and completed, verify started and completed,
  and apply started and then failed at 03:48:26.586Z with the same reason,
  and none carries `usage`. `tasks.md` still had 1.1 ticked at the end.

  Pictures, looked at:
  - After the failure: `card-change`, `FAILED AT APPLY` in red on a red
    card with a red edge, `1 of 3 tasks done`,
    `last run failed at apply 1s ago`, and `+1`.
  - At the checkpoint: `WAITING FOR YOU` with a dashed edge.
  - While running: `RUNNING`, with the task line shortened to
    `on task 1.1: Write the first file, by its own acco…` by the card's
    width. Its full text is in the card's text and title.

  Against the expectation:
  - `Running`, `on task 1.1`, by its own account, and `1 of 3 tasks done`
    hold.
  - `Failed at apply`, with a last-run line, holds.
  - The waiting word reads `Waiting for you`, not `Waiting`. That is the
    word `describeChangeState` gives for a waiting record here
    (`packages/core/src/change-state-word.ts:134`), so the card and the
    Changes list agree. It is still the waiting state
    (`data-state="waiting"`), and the card names what the run waits for and
    the directory it waits in.

  `<repo>` stands for
  `C:\Users\ivanov.a\AppData\Local\Temp\claude\C--Prog-OpenSpec-UI\9b105c30-b64d-439b-8ca5-b2db3b82c906\scratchpad\card-check\card-repo`.
