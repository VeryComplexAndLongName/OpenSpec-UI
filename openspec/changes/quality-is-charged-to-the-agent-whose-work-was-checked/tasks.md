The reader groups by a field the writer never varies. A fact about a run
is counted as a run. A gap reason misnames the gap.

## 1. The entry names the agent it is about

- [x] 1.1 `AuditEntry` in `packages/core/src/security.ts` gains
  `checkedAgent?: string`, documented as the agent whose work the checks
  covered.
- [x] 1.2 `recordVerifyChecks` in `harness-chain-runner.ts` sets it from
  the chain's resolved `apply` stage agent.
  An unset `apply` entry resolves to `DEFAULT_AGENT_ID`, which is the
  fallback `resolveRunner` applies — so the name recorded matches the
  `agent` the apply run's own entries carry and the two group together.
- [x] 1.3 `buildVerifyQuality` groups by `checkedAgent`; entries without
  it are counted and reported as recorded before the agent was named,
  not charged to any group. `describeVerifyQuality` says so when they
  exist.
  Counted in `VerifyQuality.entriesBeforeAgentNamed`. A log whose checks
  entries are all unattributed is its own sentence, distinct from
  "nothing verified yet".
- [x] 1.4 The panel row names the checked agent, and its heading says
  "by the agent whose work was checked".

## 2. A checks entry is not a run

- [x] 2.1 One predicate in core says whether an audit entry is a run;
  the checks pseudo-agent is not. Export the pseudo-agent name from one
  place.
  `isRunEntry` and `VERIFY_CHECKS_AGENT_NAME` in the new
  `packages/core/src/audit-runs.ts` — a module with no Node built-ins,
  because the browser bundle reads the same rule. The chain runner's
  private copy of the name is gone. `git-stage` entries stay runs: each
  is written as a `started`/terminal pair, so they were already counted
  as the discrete actions they are.
- [x] 2.2 `change-cost-report.ts` and `workspace-run-stats.ts` exclude
  non-run entries before pairing, so "previous runs" and the per-agent
  run counts stop counting checks.
  Consequence worth stating: a checks entry no longer appears as a row
  in the per-change cost report either. Nothing in the specification
  required that row — `verify-records-what-it-found` task 2.1 only
  observed that it read sensibly — and a row that is counted as a run
  wherever rows are counted is the defect this closes.

## 3. A gap says which nothing it is

- [x] 3.1 `recommendFromRunStats`: the cost gap distinguishes no costs
  reported, costs reported but below the threshold, and one eligible
  group with nothing to compare against. The same for the time gap if it
  has the same shape.
  It has the same shape, and so does the completion gap — all three now
  read their reason through one `gapReason` helper, taking the groups
  that reported the measure at all alongside the eligible ones. The bug
  was reading the reason off the eligible list only, which is empty in
  exactly the case the reason was wrong about.

## 4. Tests

- [x] 4.1 Core: the runner's checks entry carries `checkedAgent` equal to
  the apply stage's agent, asserted over a recorded chain run, not a
  hand-built entry.
  `harness-chain-runner.test.ts`, "records how many checks ran, that
  none failed, and whose work was checked" — the apply agent is
  `codex-cli` and the verify agent `claude-cli`, so the assertion cannot
  pass by reading the wrong stage. A second case covers the unset
  `apply` entry resolving to the default agent.
- [x] 4.2 Core: `buildVerifyQuality` fixtures use the shape the runner
  writes — `agent: "verify-checks"` with `checkedAgent` — and a legacy
  entry without it is reported, not grouped.
- [x] 4.3 Core: one chain run of apply and verify with declared checks
  yields one previous run in the recommendation's grounds.
  `harness-chain-runner.test.ts`, "counts one previous run after an
  apply and a verify whose checks failed" — a real `createAgentRunner`
  writes the apply run's entries, so the log has the shape the product
  produces. The failing-check case is the one the proposal counted: the
  verifying agent is never invoked, so the log holds one agent run and
  one checks entry, and the grounds read "2 previous runs" before this.
- [x] 4.4 Core: four runs with costs below the threshold produce a gap
  saying they are too few, not that none reported.

## 5. Verification

- [x] 5.1 `openspec validate --strict --changes`.
  Run 2026-09-10: exit 0, 9 passed, 0 failed.
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.
  Run 2026-09-10 after the last edit, redirected to a log rather than
  piped: exit 0 — 48 cli, 876 core, 320 extension, 79 server, 361 webui.
  This change adds 9 of the core tests (3 for the run predicate, 2 for
  the quality grouping, 2 for the chain runner, 2 for the gap reasons)
  and 2 of the webui tests.
- [x] 5.3 Version bump via `npx changeset` for core and webui.
  `.changeset/quality-names-the-checked-agent.md`, minor for
  `@openspec-ui/core` and `@openspec-ui/webui`.
- [x] 5.4 `LIMITS.md`, the audit entry table: the new field and what it
  means for entries written before it existed.
  There was no table — "Where the numbers come from" described the
  non-run entries in a paragraph. It now carries one, a row per kind of
  entry saying which fields it owns and whether it counts as a run,
  followed by what an entry with no `checkedAgent` means. Every checks
  entry in this repository's log is one of those, because none had been
  written when the field was added.
- [ ] 5.5 **Delegated to copilot-cli**: against a scratch change
  declaring one mechanical check, run the chain, then read the quality
  block. Assert the group names the `apply` stage's agent and not
  `verify-checks`. Evidence to record here: the run id, the audit
  entry's `checkedAgent` value, and the rendered sentence, quoted.
