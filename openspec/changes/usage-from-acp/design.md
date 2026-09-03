## Context

Read on 2026-09-03, from the installed `@agentclientprotocol/sdk` and
this repository:

- `SessionUpdate` includes `(UsageUpdate & { sessionUpdate:
  "usage_update" })`. `UsageUpdate` is `{ used, size, cost?: { amount,
  currency } }` — `used` is tokens **currently in context**, not tokens
  spent.
- `PromptResponse.usage?: Usage` is `{ totalTokens, inputTokens,
  outputTokens, thoughtTokens?, cache… }`, marked `UNSTABLE` and
  `@experimental`.
- `AcpSessionDriver.run()` pushes every notification outward as
  `agentUpdate` and keeps only `response.stopReason`.
- `agent-runner.ts` writes the terminal `AuditEntry` in a `finally`, with
  no `usage`.
- `AgentUsage` (`agent-usage.ts`) already models input/output tokens,
  `costUsd`, and a per-model split.

## Goals / Non-Goals

**Goals:**

- A run records what its agent reported spending.
- A configured ceiling compares against that.

**Non-Goals:**

- A live display.
- Any number the agent did not report.

## Decisions

### Two sources, with the stable one preferred and neither invented

`PromptResponse.usage` is the better shape — it is per-turn totals rather
than a context gauge — and it is the one the SDK marks unstable. So take
it when present, fall back to the last `usage_update`'s `cost`, and
record nothing when neither arrives.

**Rejected alternative**: use only `PromptResponse.usage`. Rejected — an
`@experimental` field is exactly the one that disappears in a version
bump, and a ceiling that silently stops working when an agent updates is
worse than one that never worked, because by then someone trusts it.

**Rejected alternative**: use only `usage_update`. Rejected — `used` is
tokens in context, which is not a spend total: it goes **down** after a
compaction. Summing it, or treating it as consumption, would produce a
confident wrong number.

### `used` is not recorded as tokens spent

The context gauge is useful to a person watching a run and misleading in
a ledger. Only `cost` is taken from a `usage_update`, and token totals
come from the prompt response alone.

**Rejected alternative**: record `used` as `inputTokens`. Rejected — it
would make the budget arithmetic wrong in the direction that matters,
under-counting a long run precisely when it compacts.

### Absent stays absent

A run whose agent reported nothing records no `usage` field at all —
never a zero.

`AuditEntry.usage`'s own contract already says "absent means no usage was
reported, **not** zero usage", and `checkBudget` is written to fail open
on absence. A zero would silently convert "we do not know" into "it cost
nothing", which is the same class of lie this change exists to remove.

### Currency is carried, not converted

`Cost` has `amount` and an ISO 4217 `currency`. `AgentUsage.costUsd` is
named for dollars. A non-USD amount is recorded with its currency and is
**not** converted at some rate this project would have to invent.

**Rejected alternative**: assume USD. Rejected for the same reason
`harness-step-effort-and-budget` refused a single `budget: number`: an
exchange rate is a vendor decision that changes under a configuration
that would not notice.

## Risks / Trade-offs

- **[Risk]** Enabling the ceiling means a chain that used to run to
  completion may now stop between stages. → That is the feature. It is
  also why the ceiling must never act on a number the agent did not
  report.
- **[Trade-off]** Only ACP adapters report anything, so a workspace on
  the raw-text CLIs sees no change. Accepted: partial coverage that says
  so beats uniform silence that reads as safety.

## Open Questions

- Whether a non-USD `cost` should be recorded in a separate field rather
  than alongside `costUsd`. Leaning yes — a field named for dollars
  holding euros is the kind of thing that reads correctly for a year and
  then bills someone wrongly.
