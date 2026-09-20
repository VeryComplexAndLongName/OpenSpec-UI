Asked for by the owner on 2026-09-19: the run budget is counted in
dollars, and some agents are billed in credits.

## 1. The chain's ceiling carries a unit

- [x] 1.1 `HarnessBudget` gains `maxCost?: Record<string, number>`: a
  ceiling per currency code, validated as a positive number per entry, and
  carried through the reader and the per-change merge.
- [x] 1.2 `harness-chain-runner.ts` sums `usage.cost.amount` per currency
  from the recorded entries and compares each configured ceiling against
  its own currency's total, beside the existing `maxCostUsd` check.
- [x] 1.3 Units are compared without regard to case, and nothing is summed
  across units or converted.
- [x] 1.4 The stop reads like the existing one: what was spent, in which
  unit, against which ceiling, and that it stopped before the next stage
  rather than because a stage failed.
- [x] 1.5 Tests: a chain stopped by a credits ceiling; two units with two
  ceilings, each counted alone; a report in a unit no ceiling names,
  which stops nothing; and `Credits` matching `credits`.

## 2. A ceiling nobody can check is named before the run

- [x] 2.1 `findHarnessConfigLimits` reports a `maxCost` ceiling whose unit
  no stage's agent is billed in, naming the unit.
- [x] 2.2 It reports one whose unit is only used by agents that report
  nothing, in the words the existing findings use.
- [x] 2.3 The configuration is still accepted: a finding, never a refusal.
- [x] 2.4 Tests for each.

## 3. The surfaces say which unit they are in

- [x] 3.1 The run budget field in both settings views is labelled as
  dollars, and one line says a ceiling in another unit is set in the
  configuration file.
- [x] 3.2 The views keep `budget.maxCost` when saving, as they keep every
  other key they do not show.
- [x] 3.3 `LIMITS.md` says which ceiling has force for which agent, and
  that for an agent reporting nothing the only ceilings with force are its
  own per-stage cap and a time ceiling.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-20: typecheck green across the workspace. core 1640 in 115
  files plus 4 in 2 for the git subprocess project, cli 165 in 16,
  extension 457 in 32, server 112 in 4, webui 622 of 623 in 71 - the one
  failure is the known Windows-only
  `scripts/build-metro-icons.test.mjs` line-ending comparison, which fails
  here on an untouched tree and passes in CI.
- [x] 4.2 A changeset: `@openspec-ui/core` minor, `@openspec-ui/webui`
  minor, and the hosts that bundle them.
- [ ] 4.3 **Human-only.** Whether a ceiling per unit reads as clearer than
  one number, and whether the finding about a dead ceiling arrives where
  it would be read.
