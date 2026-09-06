Blocked by `change-graph-in-core`: the successor check reads the stated
relation, and both checks belong in the same core module that change
establishes as the place `openspec/` is read from.

Two of the three things here exist because they cost time in one session.
The counts in the proposal are measured; keep them measured rather than
rounding them into "many".

## 1. The inbox

- [ ] 1.1 A view listing every open human-only item across active
  changes, each naming its change. The load moves: fourteen changes with
  one item each when this was written on 2026-09-06, four changes with
  seven items between them after twelve were archived the same day.
  Measure it again when implementing rather than trusting either number.
- [ ] 1.2 Reading them means parsing `tasks.md`, which
  `readTaskChecklist` in core already does for percent-complete. Extend
  that rather than adding a second parser.
- [ ] 1.3 An item is human-only by the marking `openspec/README.md`
  describes. Record what the check looks for, and treat a change that
  words it differently as a known gap rather than a silent omission.
- [ ] 1.4 Selecting one reaches the change it belongs to.
- [ ] 1.5 No control marks an item done. The rule is that a person
  reports it after observing the thing; a button here would be a
  formality, and the repository has already had two cases of items ticked
  without observation.
- [ ] 1.6 Nothing is waiting: say so, rather than showing an empty list.

## 2. A named successor is a real one

- [ ] 2.1 Find the wording actually used: `every-varying-check-has-a-budget`
  wrote "Successor created: **`load-variance-not-per-file-cost`**", and
  it is the phrasing to match first.
- [ ] 2.2 Fail when a change's tasks name a successor and no change
  states `follows` on that change.
- [ ] 2.3 State what wording was searched for, in the failure and in the
  documentation. A matcher that guessed would produce false accusations,
  which is worse than the silence it replaces.
- [ ] 2.4 Run it over the archive as it stands and record what it finds.
  If it finds nothing, say so — the three known cases have since been
  given edges, and a check that would not have caught them then is worth
  knowing about before it is trusted.

## 3. A stale spec delta is caught before the archive step

- [ ] 3.1 For each `## MODIFIED Requirements` block in an active change,
  compare its requirement header against the specification it modifies.
- [ ] 3.2 Fail when the header is absent — `harness-git-stage-no-agent`
  targeted "A stage that invokes no agent offers no agent setting" while
  the specification said "...offers none to configure".
- [ ] 3.3 Fail when the specification carries a scenario the block omits
  — `agentic-harness-git-stage` would have dropped three that another
  change had added.
- [ ] 3.4 Name the header or scenario at issue. `openspec archive` already
  does this well; the failure here should read the same, since it is the
  same failure found earlier.
- [ ] 3.5 Run it over every active change and record the result. Both
  known cases are already fixed, so a clean run is the expected outcome
  and not evidence the check works — 3.6 is.
- [ ] 3.6 Reintroduce each of the two known drifts temporarily and
  confirm the check fails on each, by name.

## 4. Verification

- [ ] 4.1 `openspec change validate --strict human-only-inbox`.
- [ ] 4.2 Unit tests for both checks over fixtures, and tree-item tests
  on fixtures rather than this repository's own changes.
- [ ] 4.3 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 4.4 Version bump via `npx changeset` for `@openspec-ui/core` and
  `openspec-ui-vscode`.
- [ ] 4.5 **Human-only**: open the inbox and confirm it lists what is
  actually waiting — count the open human-only items across active
  changes by hand first, then check the view agrees — and that selecting
  one reaches its change. Confirm the empty state too, which is now the
  common one.
