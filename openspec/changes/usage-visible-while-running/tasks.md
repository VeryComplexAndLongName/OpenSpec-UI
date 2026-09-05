The claim of this change is that a person watching a chain can answer
"what has this cost so far, and on which stage?" without leaving the
panel. A summary that only appears once the whole chain has finished
would satisfy every type in this list and none of the point.

Nothing here may invent a figure. A stage that reported nothing says so.

## 1. Announce the stage

- [x] 1.1 `packages/core/src/protocol.ts`: a `stageStarted` event with
  the stage and the agent id that will run it. Non-terminal, like
  `agentUpdate`/`cancelling`/`usageReported` — a consumer that ignores it
  is unaffected.
- [x] 1.2 `packages/core/src/harness-chain-runner.ts`: emit it
  immediately before each stage begins, for **every** stage including
  `archive` and `git`. Those have no agent; use `""`, the convention
  `checkpoint.nextAgentId` already established, not `"unknown"`.
- [x] 1.3 Emit it before the budget check that can refuse the stage, or
  after — pick one and say why in a comment. A stage refused at the
  ceiling either never started (so never announce it) or was announced
  and then refused; the display's wording depends on which.
- [x] 1.4 `packages/extension/src/describe-event.ts` and
  `AiPanel.tsx`'s `describeEvent`: both switches are exhaustive over
  `Event["kind"]` and will not compile without the new case. Add it.

## 2. Accumulate

- [x] 2.1 `packages/webui/src/`: a pure function turning an event list
  into per-stage and total usage. Pure and exported, so it is testable
  without rendering anything — the same shape `collapseStreamEvents`
  already has.
- [x] 2.2 Attribute each `usageReported` to the stage most recently
  announced by `stageStarted`. Usage arriving before any `stageStarted`
  (a single-command run, not a chain) belongs to no stage and is still
  counted in the total.
- [x] 2.3 Sum `costUsd` separately from `cost.currency` amounts, and
  group the latter by currency code. No combined figure.
- [x] 2.4 A stage with no report is distinguishable from a stage that
  reported zeros. Do not represent "unreported" as `0`.
- [x] 2.5 Read the in-flight `usage_update` figures out of the
  `agentUpdate` events that already carry them, keeping the latest per
  stage. `used` is context occupancy — keep it in its own field, never in
  a token total.

## 3. Show

- [x] 3.1 A usage summary rendered with the chain panel: total, and a row
  per stage that has started, in stage order.
- [x] 3.2 Colour a stage row by what happened to it (running, completed,
  failed, cancelled) using the existing `openspec-event--<kind>` class
  convention. Not by how much it spent — see design.md decision 6.
  There is no "not reached" state: the chain never publishes its planned
  sequence, so a stage that has not started is not listed at all rather
  than listed as pending. Showing a pending list would mean this view
  re-deriving the stage sequence itself, which is the chain's decision to
  make and would go wrong the moment the chain skipped a stage.
- [x] 3.3 The live figure, where an agent sends one, labelled as the
  agent's own running report and visibly not part of the recorded total.
- [x] 3.4 The configured ceiling beside the recorded total when one is
  configured, and nothing implying a ceiling when none is.
- [x] 3.5 Say, where an agent reports nothing at all, that it reports
  nothing — a panel that simply never moves is indistinguishable from one
  that is broken.
- [x] 3.6 `LIMITS.md`: where to watch usage while a run is in progress,
  and that the live figure and the recorded total are not the same
  number. A reader who conflates them will think a ceiling is acting on
  something it never sees.

## 4. Tests

- [x] 4.1 The accumulator: usage before any `stageStarted` counts toward
  the total; usage after one is attributed to that stage; a second
  `stageStarted` moves attribution.
- [x] 4.2 The accumulator: two costs in different currencies produce two
  figures, never a sum.
- [x] 4.3 The accumulator: a stage that reported nothing is not reported
  as zero. Assert this explicitly — a test that only checks the reporting
  case passes with the confusion intact.
- [x] 4.4 The accumulator: an in-flight `usage_update`'s `used` never
  appears in a consumed-token total.
- [x] 4.5 The panel: a chain that fails mid-stage still names the stage
  that spent, which is exactly the case `stageCompleted` alone could not
  cover.
- [x] 4.6 `harness-chain-runner.test.ts`: `stageStarted` is emitted for
  every stage, in order, and its presence changes no existing outcome —
  the existing chain assertions still pass unchanged.

## 5. Verification

- [x] 5.1 `openspec change validate --strict usage-visible-while-running`.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test`. Read the
  whole failing-file list, not the first familiar line.
- [x] 5.3 Version bump via `npx changeset`.
- [x] 5.4 **Human-only**: run a chain on `claude-cli-acp` and confirm the
  summary fills in per stage as the chain advances, and that a stage
  whose agent reported nothing says so rather than showing `$0.00`.
- [x] 5.5 Record what 5.4 measured in `LIMITS.md`: `claude-cli-acp` moves
  from *expected* to **measured** (60 input, 8,262 output, 1,693,507
  cache tokens, $1.57 for one stage), and the same figure shows that
  `maxTokens` counts under half a percent of what such a stage moves,
  because `checkBudget` sums input and output only.
