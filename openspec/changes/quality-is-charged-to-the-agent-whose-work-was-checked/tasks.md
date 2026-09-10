The reader groups by a field the writer never varies. A fact about a run
is counted as a run. A gap reason misnames the gap.

## 1. The entry names the agent it is about

- [ ] 1.1 `AuditEntry` in `packages/core/src/security.ts` gains
  `checkedAgent?: string`, documented as the agent whose work the checks
  covered.
- [ ] 1.2 `recordVerifyChecks` in `harness-chain-runner.ts` sets it from
  the chain's resolved `apply` stage agent.
- [ ] 1.3 `buildVerifyQuality` groups by `checkedAgent`; entries without
  it are counted and reported as recorded before the agent was named,
  not charged to any group. `describeVerifyQuality` says so when they
  exist.
- [ ] 1.4 The panel row names the checked agent, and its heading says
  "by the agent whose work was checked".

## 2. A checks entry is not a run

- [ ] 2.1 One predicate in core says whether an audit entry is a run;
  the checks pseudo-agent is not. Export the pseudo-agent name from one
  place.
- [ ] 2.2 `change-cost-report.ts` and `workspace-run-stats.ts` exclude
  non-run entries before pairing, so "previous runs" and the per-agent
  run counts stop counting checks.

## 3. A gap says which nothing it is

- [ ] 3.1 `recommendFromRunStats`: the cost gap distinguishes no costs
  reported, costs reported but below the threshold, and one eligible
  group with nothing to compare against. The same for the time gap if it
  has the same shape.

## 4. Tests

- [ ] 4.1 Core: the runner's checks entry carries `checkedAgent` equal to
  the apply stage's agent, asserted over a recorded chain run, not a
  hand-built entry.
- [ ] 4.2 Core: `buildVerifyQuality` fixtures use the shape the runner
  writes — `agent: "verify-checks"` with `checkedAgent` — and a legacy
  entry without it is reported, not grouped.
- [ ] 4.3 Core: one chain run of apply and verify with declared checks
  yields one previous run in the recommendation's grounds.
- [ ] 4.4 Core: four runs with costs below the threshold produce a gap
  saying they are too few, not that none reported.

## 5. Verification

- [ ] 5.1 `openspec validate --strict --changes`.
- [ ] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.
- [ ] 5.3 Version bump via `npx changeset` for core and webui.
- [ ] 5.4 `LIMITS.md`, the audit entry table: the new field and what it
  means for entries written before it existed.
- [ ] 5.5 **Delegated to copilot-cli**: against a scratch change
  declaring one mechanical check, run the chain, then read the quality
  block. Assert the group names the `apply` stage's agent and not
  `verify-checks`. Evidence to record here: the run id, the audit
  entry's `checkedAgent` value, and the rendered sentence, quoted.
