## Why

A chain run now records what it spent (`usage-from-acp`), but nothing
shows it to the person watching the run. The number exists in
`.openspec-ui/audit.jsonl` and in a `usageReported` event that scrolls
past in the event log as one line of text among hundreds.

The request behind this change was specific: see spent tokens, credits
and USD while the harness works, distinguish the stages, and have the
configured ceiling be legible against those same numbers. Today a person
running a five-stage chain can answer "did it finish?" and cannot answer
"what has this cost me so far?" without reading a JSONL file by hand.

There is also a live channel already arriving and being dropped on the
floor. An ACP agent sends `usage_update` notifications *during* a run —
context `used`/`size` and a cumulative `cost` — and `AcpSessionDriver`
forwards each one outward as an `agentUpdate`. Every surface renders it
as `agent update: usage_update` and discards the numbers. This is exactly
what Claude's and Copilot's own interfaces show live, reaching us
already.

One thing is genuinely missing for attribution: **a surface cannot tell
which stage is running.** The chain publishes every stage's events under
one `runId` and announces a stage only when it *ends*
(`stageCompleted`/`checkpoint`). The first stage's usage therefore has no
stage to belong to, and a chain that stops mid-stage never names the
stage that spent the money.

## What Changes

- `packages/core/src/protocol.ts`: a `stageStarted` event, emitted by
  `HarnessChainRunner` before each stage begins. Non-terminal, like
  `agentUpdate`/`cancelling`/`usageReported` — a surface that ignores it
  behaves exactly as today.
- `packages/webui`: a usage summary rendered beside a running chain —
  per-stage and total, tokens and money, with the in-flight `usage_update`
  figures shown separately from settled per-run reports.
- The configured ceiling shown next to the recorded total, so "recorded
  $3.40 of $25.00" is readable without opening a config file.

## Capabilities

### New Capabilities

(none — extends `shared-ui`, with one event added to `execution-core`'s
protocol)

### Modified Capabilities

- `shared-ui`: a run's resource usage is visible while it runs, attributed
  to the stage that spent it, and legible against the configured ceiling.

## Impact

- `packages/core/src/protocol.ts`,
  `packages/core/src/harness-chain-runner.ts` (one new event, no change to
  any decision it makes).
- `packages/webui/src/components/` — a new usage component and its use in
  the chain panel.
- No change to `checkBudget`, `buildUsageReport` or `AuditEntry`. What
  enforces a ceiling is untouched; this change makes it visible.

## Explicitly out of scope

- **Enforcing a ceiling on in-flight figures.** `checkBudget` acts on
  recorded audit usage at stage boundaries, and ADR 0018 decision 7 is
  explicit that a run's cost is not known until it ends. Displaying an
  in-flight figure must not quietly become a second enforcement path with
  different numbers.
- **Asking a provider for an account balance.** A provider's billing page
  counts every session on that account, including work this product never
  started. That is a different question from "what did this chain spend",
  and one number answering both would answer neither.
- **Inventing a figure where an agent reported none.** A stage whose agent
  reports nothing shows "not reported" — never `$0.00`.
