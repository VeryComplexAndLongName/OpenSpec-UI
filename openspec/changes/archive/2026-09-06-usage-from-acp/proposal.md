## Why

A configured spending ceiling does nothing today.

`HarnessChainRunner.checkBudget` compares `budget.maxCostUsd` /
`budget.maxTokens` against the usage recorded in the audit log. Nothing
ever records any. `AuditEntry.usage` is typed, `buildUsageReport` reads
it, `checkBudget` sums it — and across the whole of `packages/*/src`, the
string `usage:` appears **only in tests**. The terminal audit record in
`agent-runner.ts` writes `runId`, `agent`, `outcome`, `cwd`, `timestamp`,
`changeDir`, `invocation`, `reason` and `summary`. No usage.

So `totalsByChange[changeDir]` is always empty, `checkBudget` always
returns "nothing to compare against", and the chain-level budget
**cannot stop anything, for any agent, under any configuration**.

`LIMITS.md` describes the honest posture — a ceiling can only count what
an agent reported, and an unmeasured change never trips it — but a reader
takes that as a dependency on the agent's talkativeness rather than as
the current state. Someone sets a ceiling on their spending and believes
they are protected.

The data is already there for ACP agents, and already flowing through our
own pipeline. The ACP schema this project already speaks defines:

- `SessionUpdate`'s `"usage_update"` variant → `UsageUpdate`: `used`
  tokens in context, context `size`, and an optional cumulative
  `cost: { amount, currency }`;
- `PromptResponse.usage` → `Usage`: `totalTokens`, `inputTokens`,
  `outputTokens`, `thoughtTokens`, cache-read tokens — marked
  `UNSTABLE`/`@experimental` in the SDK.

`AcpSessionDriver` forwards every `session/update` outward verbatim as an
`agentUpdate`, `usage_update` included, and takes only `stopReason` from
the prompt response, discarding `usage`. This is what Claude and Copilot
show in their own interfaces, live: not an undocumented feature, a
channel we receive and drop.

## What Changes

- `packages/core/src/agents/acp-session-driver.ts`: read usage from the
  stream and from the prompt response, and make it available to the run.
- `packages/core/src/agent-runner.ts`: the terminal audit record carries
  the run's reported usage, so `buildUsageReport` and therefore
  `checkBudget` finally have something to sum.
- `LIMITS.md`: say which agents report usage and which do not, so a
  ceiling's reach is legible before someone relies on it.

## Capabilities

### New Capabilities

(none — extends `execution-core`)

### Modified Capabilities

- `execution-core`: a run records what it reported spending, and a
  configured ceiling is compared against real recorded usage rather than
  against nothing.

## Impact

- `packages/core/src/agents/acp-session-driver.ts`,
  `packages/core/src/agent-runner.ts`, `packages/core/src/agent-usage.ts`.
- `LIMITS.md`.
- No change to `checkBudget`, `buildUsageReport`, or the `AuditEntry`
  shape — all three were written for this and have been waiting for a
  producer.

## Explicitly out of scope

- Displaying usage while a run is in progress. That is worth doing and is
  its own change; this one makes the number exist and be recorded.
- Extracting usage from the raw-text CLI adapters. They have no
  structured channel, and guessing from scraped output is what ADR 0017
  exists to prevent.
- Asking a provider for account balance or billing. A provider knows
  about every session, including runs this product never started; that is
  a different question from what this change cost, and merging the two
  into one number would answer neither.
