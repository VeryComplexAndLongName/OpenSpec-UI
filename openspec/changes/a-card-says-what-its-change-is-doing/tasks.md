One card per change, derived in core from the readings the hosts already
take, with the chain's ending recorded so a card can say how the last run
ended (ADR 0029).

## 1. What the survey carries for a card

- [ ] 1.1 `SurveyedChange` in `packages/core/src/worktree-survey-facts.ts`
  gains four fields:
  - `tasksForPerson`: the number of open Human-only items;
  - `tasksDelegated`: the number of open delegated items;
  - `nextOpenTask?: { number: string; text: string }`: the first open item
    that is neither Human-only nor delegated, numbered by `taskNumberOf`;
  - `tasksModifiedAt?: string`: the task list's modification time.

  `surveyChanges` in `worktree-survey.ts` fills them from the items it
  already reads, plus one `stat` per list.
- [ ] 1.2 core `worktree-survey.test.ts`:
  - the two counts;
  - the first open task skips a Human-only item and a delegated item;
  - a change with no task list carries none of the four fields.

## 2. A chain writes its own ending

- [ ] 2.1 In `packages/core/src/audit-runs.ts`, add
  `CHAIN_ENDING_AGENT_NAME = "chain"` beside `VERIFY_CHECKS_AGENT_NAME`,
  and make `isRunEntry` return `false` for it as well. Its comment says why:
  like the checks entry, it has one terminal entry and no `started`
  partner.
- [ ] 2.2 `HarnessChainRunner` in `packages/core/src/harness-chain-runner.ts`
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
- [ ] 2.3 Check each reader that totals the log, and record the check:
  - `buildChangeCostReport` and `buildWorkspaceRunStats` skip the entry
    through `isRunEntry`;
  - `runTimestampsByChange` counts no run for it;
  - the quality readback in `verify-quality.ts` counts no run and no spend
    for it.

  Do not add a second filter beside `isRunEntry`.
- [ ] 2.4 core tests:
  - `harness-chain-runner.test.ts`: one ending entry for each of the six
    endings, with its stage and reason;
  - `change-cost-report.test.ts` and `workspace-run-stats.test.ts`: a log
    containing a chain ending gives the same rows and totals as the same
    log without it.

## 3. How the last run ended

- [ ] 3.1 `packages/core/src/last-runs-facts.ts` uses no Node imports and is
  exported from `browser.ts`. It defines:
  - `LastRun { runId: string; outcome: "completed" | "failed" | "cancelled"; stage?: string; endedAt: string; reason?: string; costUsd?: number }`
  - `LastRunsReport { byChange: Record<string, LastRun> }`
- [ ] 3.2 `readLastRuns({ workspaceRoot, git? }): Promise<LastRunsReport>`
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
- [ ] 3.3 `readRepositoryAuditEntries` in
  `packages/core/src/repository-audit.ts` accepts an optional cache. With
  one, it parses a file again only when the file's size or modification
  time has changed. `readLastRuns` passes a cache that lives for the whole
  module.
- [ ] 3.4 core `last-runs.test.ts`:
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

## 4. Carried to both hosts

- [ ] 4.1 Add `handleChangeLastRunsRequest` to `packages/server/src/rest.ts`,
  routed at `POST /api/change-last-runs` in `server.ts` beside
  `/api/change-readiness`. It answers:
  - 400 when the body has no `cwd`;
  - the same authorization as the readiness route;
  - 200 with `readLastRuns({ workspaceRoot: cwd })`.
- [ ] 4.2 A server route test covers all three answers.
- [ ] 4.3 Add `packages/webui/src/change-last-runs-client.ts`, shaped like
  `change-readiness-client.ts`.
- [ ] 4.4 The pipeline panel in
  `packages/extension/src/webview/pipeline-panel.ts` answers
  `pipeline/last-runs` with `readLastRuns({ workspaceRoot })`.
  `BridgeOperation` gains `pipeline/last-runs`, and `pipeline-entry.tsx`
  passes it to the view.
- [ ] 4.5 `PipelineViewProps` gains
  `lastRuns?: () => Promise<LastRunsReport>`. It is read together with the
  survey: on the survey's interval without `subscribe`, and on the survey's
  signal with it. `standalone-entry.tsx` and `pipeline-entry.tsx` both pass
  it.

## 5. The cards

- [ ] 5.1 `packages/core/src/change-card.ts` uses no Node imports and is
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
- [ ] 5.2 A change's facts come from its own worktree when a surveyed
  directory's `belongsTo` names the change, and otherwise from this
  directory's survey entry. Its runs are the surveyed runs of that directory
  whose `changeName` is the change and that are not gone.
- [ ] 5.3 `state` follows this precedence. The first match wins:
  1. `waiting`, for a live run whose record is waiting;
  2. `running`, for any other live run, or when readiness says `running` and
     no run is surveyed;
  3. `failed` or `stopped`, when the last run ended `failed` or `cancelled`
     and its `endedAt` is not earlier than `tasksModifiedAt`;
  4. `blocked`;
  5. `done`, when `total > 0` and every task is done;
  6. `ready`.
- [ ] 5.4 The guess: when a live run's record names no task, `task` is the
  survey's `nextOpenTask`, with source `guess`. When no run is live, there is
  no `task`.
- [ ] 5.5 `describeChangeCard(card, now)` returns `{ stateWords, lines }`.
  - `stateWords` is one of `Running`, `Waiting`, `Failed at <stage>`,
    `Stopped at <stage>`, `Blocked`, `Ready` or `Done`. It is plain
    `Failed` or `Stopped` when the run had no stage.
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
- [ ] 5.6 `LocalPicture` in `packages/webui/src/components/PipelineView.tsx`
  draws each card's state line and detail lines from `describeChangeCard`.
  It keeps the collision lines readiness already gives, and applies the
  existing line budget, so lines past the budget stay available. Do not
  compute any of these words in the view.
- [ ] 5.7 `packages/webui/src/shell-ui.ts` gives the `Waiting`, `Failed at`
  and `Stopped at` state words tokens of their own. Every state is told
  apart by its word; colour agrees with the word and is never the only
  difference.
- [ ] 5.8 The directory's run lines above the picture stay for runs no card
  here shows: a run that names no change, or a run of another directory's
  change. They no longer repeat a run a card already shows.

## 6. Tests

- [ ] 6.1 core `change-card.test.ts`:
  - one input for each precedence case in 5.3;
  - a failure older than the task list;
  - a stop with a reason, and one without;
  - a waiting run;
  - a guess that skips a Human-only item and a delegated item;
  - a change with its own worktree, whose progress and runs come from that
    worktree and whose card names it.
- [ ] 6.2 core `change-card.test.ts`, for `describeChangeCard`:
  - the words for each state and for each line;
  - a cost only where one was reported;
  - ages counted from `now`.
- [ ] 6.3 webui `PipelineView.test.tsx`:
  - a card shows the state words and lines the core function returns;
  - a card with more lines than its budget still carries every line;
  - a run shown on a card is not repeated in the run lines above the
    picture.
- [ ] 6.4 browser `e2e/pipeline.spec.ts`:
  - a fixture change whose audit log shows its latest chain failing at
    verify shows `Failed at verify`;
  - no drawn line is cut;
  - the tab passes axe at WCAG AA.

## 7. Verification

- [ ] 7.1 This change validates strictly. `check(validate-change)`
- [ ] 7.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and each package's test count.
- [ ] 7.3 A pending changeset exists, with core, webui, server and the
  extension each at minor. `check(changeset-present)`
- [ ] 7.4 Run the whole browser suite, not a selected spec. Regenerate
  `docs/images/standalone/pipeline.png` and look at it.
- [ ] 7.5 **Delegated to claude-cli**: check a card against a real chain.

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
