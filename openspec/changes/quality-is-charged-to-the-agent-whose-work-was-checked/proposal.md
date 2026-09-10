# Quality is charged to the agent whose work was checked

## Why

Found by the code review of 2026-09-10. `quality-of-what-a-verify-found`
reads what the verifying stages found "per agent", and the only writer
of those entries records a pseudo-agent.

**The per-agent breakdown can name only one agent, and it is not an
agent.** `recordVerifyChecks` (`packages/core/src/harness-chain-runner.ts:
1206`) writes every checks entry with `agent: "verify-checks"`; grep finds
no other writer of `checksRan`. `buildVerifyQuality`
(`verify-quality.ts:82, 97`) groups by `entry.agent`. On any workspace
after a few chain runs the panel shows exactly one row — **verify-checks**
— whatever ran the apply. The module's header promises "an agent that is
cheap and fails its checks is not the cheap one"; the row cannot say which
one that is. The entry carries no field naming the agent whose work the
checks covered, so this cannot be fixed in the reader. The tests use
`agent: "claude-cli"` with `checksRan` set, a shape the runner never
produces, and pass against data that does not exist. Nobody has seen the
wrong row yet only because this repository's runs have not reached a
verifying stage with declared checks.

**The checks entry is counted as a previous run.** `change-cost-report.ts:
128-141` lists every terminal entry without a `started` partner as "a run
refused before it started"; a checks entry has no partner; the
recommendation (`harness-recommendation.ts:85`) reports "2 previous runs"
after one chain run of apply and verify.

**A gap says "no agent has reported a cost" when agents did and are
thin.** `run-recommendations.ts:89-94` filters to the eligible groups
before writing the reason, so four runs each with a cost read as "no
agent has reported a cost across 4 recorded run(s)".

## Capabilities

### Modified

- A checks entry records the agent whose work the checks covered, and
  the quality readback groups by it.
- A checks entry is not a run, in the recommendation's count or anywhere
  a run is counted.
- A recommendation's gap says whether costs were absent or too few.

## Out of scope

Recording which checks failed by name. The count is what the spec
promised and what the entry carries; names are a different entry.
