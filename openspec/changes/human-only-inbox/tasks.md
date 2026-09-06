Blocked by `change-graph-in-core`: the successor check reads the stated
relation, and both checks belong in the same core module that change
establishes as the place `openspec/` is read from.

Two of the three things here exist because they cost time in one session.
The counts in the proposal are measured; keep them measured rather than
rounding them into "many".

## 1. The inbox

- [x] 1.1 A view listing every open human-only item across active
  changes, each naming its change. The load moves: fourteen changes with
  one item each when this was written on 2026-09-06, four changes with
  seven items between them after twelve were archived the same day.
  Measure it again when implementing rather than trusting either number.
  Done: `HumanOnlyInboxTreeProvider` in
  `packages/extension/src/tree/human-only-inbox-tree.ts`, registered as
  the "Human-Only Inbox" view (`openspecUiHumanOnlyInbox`) in
  `package.json` and `extension.ts`. Measured again while implementing,
  by running `readTaskChecklist` over every active change on 2026-09-06:
  4 active changes carry exactly one open human-only item each —
  `chain-answers-a-permission-request`, `dependabot-block-action-majors`,
  `reveal-across-changes-and-graph`, and this change itself (its own task
  4.5) — matching the proposal's "one item each" shape, not the "seven
  between four" shape; the queue keeps changing as changes archive and
  new ones open, which is the whole point.
- [x] 1.2 Reading them means parsing `tasks.md`, which
  `readTaskChecklist` in core already does for percent-complete. Extend
  that rather than adding a second parser.
- [x] 1.3 An item is human-only by the marking `openspec/README.md`
  describes. Record what the check looks for, and treat a change that
  words it differently as a known gap rather than a silent omission.
  Done: `isHumanOnlyTask` in `packages/core/src/task-checklist.ts` — a
  task's first bold (`**...**`) span begins with "Human-only",
  case-insensitive; documented inline with the 2026-09-06 measurement
  (44 of 45 bolded leads).
- [x] 1.4 Selecting one reaches the change it belongs to.
  Done: each row's `.command` is `openspec-ui.revealTask`, the same
  command the Changes tree's own task rows use — it opens the change's
  `tasks.md` at that line.
- [x] 1.5 No control marks an item done. The rule is that a person
  reports it after observing the thing; a button here would be a
  formality, and the repository has already had two cases of items ticked
  without observation.
  Done: rows use the distinct `openspec-ui.humanOnlyInboxItem`
  contextValue (not the Changes tree's `openspec-ui.activeTask`), so
  `openspec-ui.deleteTask` — the only mutating command bound to a task's
  contextValue in `package.json` — cannot match here. Verified in
  `human-only-inbox-tree.test.ts`.
- [x] 1.6 Nothing is waiting: say so, rather than showing an empty list.
  Done: an `EmptyTreeItem("Nothing is waiting on a person", ...)` row,
  same pattern `ChangeGraphTreeProvider` already uses.

## 2. A named successor is a real one

- [x] 2.1 Find the wording actually used: `every-varying-check-has-a-budget`
  wrote "Successor created: **`load-variance-not-per-file-cost`**", and
  it is the phrasing to match first.
  Done: `NAMED_SUCCESSOR_RE` in `packages/core/src/successor-check.ts`.
- [x] 2.2 Fail when a change's tasks name a successor and no change
  states `follows` on that change.
  Done: `checkNamedSuccessors` in `packages/core/src/successor-check.ts`,
  tested in `successor-check.test.ts`.
- [x] 2.3 State what wording was searched for, in the failure and in the
  documentation. A matcher that guessed would produce false accusations,
  which is worse than the silence it replaces.
  Done: the regex and its rationale are documented at the top of
  `successor-check.ts`; each violation's `reason` quotes the exact
  wording it matched.
- [x] 2.4 Run it over the archive as it stands and record what it finds.
  If it finds nothing, say so — the three known cases have since been
  given edges, and a check that would not have caught them then is worth
  knowing about before it is trusted.
  Run on 2026-09-06 (`findNamedSuccessors` over every archived change's
  `tasks.md`, cross-checked against `readChangeGraph`): exactly one
  "Successor created:" wording exists in the archive —
  `every-varying-check-has-a-budget` naming
  `load-variance-not-per-file-cost` — and it is not orphaned:
  `load-variance-not-per-file-cost` already states `follows:
  every-varying-check-has-a-budget`. So the check, run retroactively over
  the whole archive, finds zero violations today. It would not have
  caught the case when it mattered, before that edge existed — a human
  verification item did, per `change-dependency-graph`'s own record. The
  shipped check (`checkNamedSuccessors`) only scans active changes, which
  is the case where the check can still act before a change is archived;
  this archive run was exploratory, not something the check itself does
  going forward. The check does now run against this repository on every
  pull request: `successor-check.test.ts` carries a "this repository's own
  changes" gate, in the shape `change-graph.test.ts` established, which
  asserts the graph it read is non-empty before asserting the result is
  clean — a clean result that is only clean because nothing was read is
  the failure mode a gate like this has. Also found: a false positive in this very file — task
  2.1's own quoted example matched the pattern before
  `findNamedSuccessors` was taught to skip a match preceded by a quote
  character (see the comment above that function).

## 3. A stale spec delta is caught before the archive step

- [x] 3.1 For each `## MODIFIED Requirements` block in an active change,
  compare its requirement header against the specification it modifies.
  Done: `checkSpecDeltaDrift`/`checkSpecDeltaAgainstSpec` in
  `packages/core/src/spec-delta-check.ts`.
- [x] 3.2 Fail when the header is absent — `harness-git-stage-no-agent`
  targeted "A stage that invokes no agent offers no agent setting" while
  the specification said "...offers none to configure".
  Tested in `spec-delta-check.test.ts` by reproducing that exact pair of
  headers as a fixture.
- [x] 3.3 Fail when the specification carries a scenario the block omits
  — `agentic-harness-git-stage` would have dropped three that another
  change had added.
  Tested in `spec-delta-check.test.ts` by reproducing that change's four
  real scenario titles as a fixture, three omitted from the block.
- [x] 3.4 Name the header or scenario at issue. `openspec archive` already
  does this well; the failure here should read the same, since it is the
  same failure found earlier.
  Done: each reason string quotes the header or scenario title with
  `JSON.stringify`.
- [x] 3.5 Run it over every active change and record the result. Both
  known cases are already fixed, so a clean run is the expected outcome
  and not evidence the check works — 3.6 is.
  Run on 2026-09-06 (`checkSpecDeltaDrift` over this repository's own
  `openspec/changes/*/specs/*/spec.md`): zero violations. Expected, not
  evidence — see 3.6. Measured what the run actually reached, because a
  check that resolves no spec file reports zero the same way: 5 delta
  specs across the active changes, all 5 resolving to a specification,
  one of them carrying a `## MODIFIED Requirements` block that was really
  compared. `spec-delta-check.test.ts` now carries a "this repository's
  own changes" gate asserting both — non-empty reach, then no drift — so
  the run repeats on every pull request rather than having happened once.
- [x] 3.6 Reintroduce each of the two known drifts temporarily and
  confirm the check fails on each, by name.
  Done as fixtures rather than editing real archived files (per task
  4.2's "fixtures rather than this repository's own changes"):
  `spec-delta-check.test.ts` reproduces `harness-git-stage-no-agent`'s
  exact renamed header ("...offers no agent setting" vs. the
  specification's "...offers none to configure") and
  `agentic-harness-git-stage`'s exact four scenario titles with three
  omitted, and asserts each failure names the header or scenario at
  issue.

## 4. Verification

- [x] 4.1 `openspec change validate --strict human-only-inbox`.
  Run 2026-09-06: "Change 'human-only-inbox' is valid".
- [x] 4.2 Unit tests for both checks over fixtures, and tree-item tests
  on fixtures rather than this repository's own changes.
  Done: `successor-check.test.ts`, `spec-delta-check.test.ts`, and
  `human-only-inbox-tree.test.ts` — all against temporary directories or
  mocked workspace data, not this repository's real `openspec/changes/`.
  Each of the two check files additionally carries one "this repository's
  own changes" gate, which is not a unit test and is the point of the
  checks: without it neither would ever run over this tree, and both were
  proposed to fail a pull request here. `change-graph.test.ts` separates
  the two the same way, and this follows it.
- [x] 4.3 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  First run 2026-09-06 left `npm run lint` failing at
  `lint:test-budgets`: both new test files write temporary directories,
  which that policy calls cost-varying, and neither stated a budget. The
  item was ticked anyway, with the failure written underneath it and the
  instruction to fix it first — the exact order `openspec/README.md`
  warns against.
  Corrected: each file now carries `vi.setConfig({ testTimeout: 20_000 })`
  above a measurement taken on an idle machine (`successor-check.test.ts`
  579ms, `spec-delta-check.test.ts` 397ms, the repository gates being
  402ms and 302ms of those). Re-run after that on an idle machine,
  2026-09-06: `npm run typecheck` clean; `npm run lint` clean apart from
  one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); `npm run test` 46 in
  `@openspec-ui/cli`, 594 in `@openspec-ui/core`, 253 in
  `openspec-ui-vscode`, 61 in `@openspec-ui/server`, 263 in
  `@openspec-ui/webui` — all passing.
- [x] 4.4 Version bump via `npx changeset` for `@openspec-ui/core` and
  `openspec-ui-vscode`.
  Done: `.changeset/human-only-inbox.md`, `npx changeset status`
  confirms both packages bump minor.
- [ ] 4.5 **Human-only**: open the inbox and confirm it lists what is
  actually waiting — count the open human-only items across active
  changes by hand first, then check the view agrees — and that selecting
  one reaches its change. Confirm the empty state too, which is now the
  common one.
  Reopened 2026-09-06 after being ticked by an implementing agent, which
  recorded a by-hand count and a passing test run in place of the
  observation. Neither is the thing asked for: nobody has opened the view
  in a running VS Code window, which is the only way to learn that it
  renders, that a row reaches its change, and that the empty state reads
  as intended. This change's own spec says a person reports such an item
  after observing the thing; closing the human-only item of the
  human-only inbox from a test run would be the first violation of the
  rule the change exists to protect. The by-hand count the agent made is
  worth keeping: 4 open human-only items across active changes, one each
  in `chain-answers-a-permission-request`,
  `dependabot-block-action-majors`, `reveal-across-changes-and-graph`,
  and this change.
