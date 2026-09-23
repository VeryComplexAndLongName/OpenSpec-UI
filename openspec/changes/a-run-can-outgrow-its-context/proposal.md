## Why

Asked by the owner on 2026-09-23, after the answer to "how do we limit
DeepSeek?" turned out to be "by time, and by nothing else".

`dsh` reports no cost, no credits and no token split. Measured the same
day: the only figure it sends is ACP's `usage_update`, carrying `used`
and `size` - the tokens now in the session's context, against a
1,000,000-token window. `budget.maxCostUsd` has nothing to compare;
`budget.maxTokens` has nothing to compare; the configuration refuses
either for that agent. `timeout` is the whole of what bounds it.

That figure is deliberately not counted as a spend, and that decision
stands: it goes down after a compaction, so counting it as consumption
would under-count exactly the long runs that compact. But it says
something else, and something worth acting on. A session that has filled
most of its window is one whose every further turn carries the whole
conversation again: slower, dearer, and worse at the task than the same
work started fresh.

And it has a property no spending ceiling has. It arrives **during** the
run. Of everything this product configures, only `timeout` could stop a
stage already going.

## What Changes

- `budget.maxContextShare`: a share between 0 and 1 of the model's
  context window. Reaching it ends the run as **cancelled**, with the
  reason naming the ceiling, the reading, and both figures - the posture
  `timeout` already takes, because a ceiling doing its job is not a
  defect.
- A value outside `(0, 1]` is refused where the configuration resolves,
  so somebody who means eighty percent and writes `80` is told rather
  than handed a ceiling that could never fire.
- The gauge is read in one place, beside the protocol, as every other
  reading of an ACP payload here is. A `size` of zero reads as no gauge
  rather than as a full window.
- `HARNESS_AGENT_CAPABILITIES` gains `contextGauge`, a different question
  from `reports`: whether the agent says how full its context is. `"none"`
  with certainty for an agent that speaks no ACP at all, `"sends"` for
  `deepseek-cli-acp` from the measurement, `"unknown"` for every ACP
  agent nobody here has watched.
- The settings surfaces say, before a run, that this ceiling cannot act
  where the stage's agent speaks no ACP - and stop calling a stage
  unbounded where this ceiling does bind it.
- `deepseek-cli-acp`'s capability comment is corrected: it claimed no
  `usage_update` arrives, which 2026-09-23 disproved.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - a ceiling on how full a run's context may get.

## Impact

- `packages/core/src/acp-context-gauge.ts` (new) and its tests.
- `packages/core/src/harness-config.ts`, `harness-config-schema.ts`,
  `harness-step-agent.ts`, `harness-config-findings.ts`,
  `harness-chain-runner.ts`, and their tests.
- `packages/extension/schemas/*.json`, regenerated.
- `HARNESS.md`, `LIMITS.md`.
- One requirement in `openspec/specs/execution-core/spec.md`.

## Explicitly out of scope

- **Counting the gauge as usage.** It is not a spend, it falls after a
  compaction, and nothing here converts one into the other.
- **A control in the settings forms.** Those forms offer the run budget
  and the stage models; every other ceiling - `maxTokens`,
  `maxStageCostUsd`, `timeout` - rides on the configuration file, and
  this one is no different.
- **Claiming a gauge for the ACP agents nobody here has watched.**
  Asserting silence would be reporting a measurement nobody made, and no
  warning is raised about them for the same reason.
