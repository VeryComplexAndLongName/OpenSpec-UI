## Why

`LIMITS.md` tells a reader which agents report usage, so that a person
setting a ceiling can tell whether it can reach their runs. It was
written from the adapters' source, before any agent had reported
anything. There is now evidence, and it does not say quite what the
document says.

`.openspec-ui/audit.jsonl` in this repository, read on 2026-09-04. Four
runs have terminated since `usage-from-acp` merged:

| When | Agent | Outcome | Usage recorded |
| --- | --- | --- | --- |
| 13:31 | `copilot-cli-acp` | failed | none |
| 13:33 | `copilot-cli-acp` | failed | none |
| 13:40 | `claude-cli-acp` | failed | none |
| 14:03 | `copilot-cli-acp` | completed | `{inputTokens: 786966, outputTokens: 4732, thoughtTokens: 1308}` |

Two things follow, and one of them changes what a ceiling can do.

**`copilot-cli-acp` reports tokens and does not report cost.** No
`costUsd`, no `cost` — measured, not inferred. So `budget.maxCostUsd`
over a chain running on Copilot compares against nothing and can never
fire, however large the spend. `budget.maxTokens` is the only ceiling
that can act on it. `LIMITS.md` currently says only that an ACP agent
sends "token totals, a cost, or nothing", which is true and leaves the
reader to discover which — for the one agent this repository runs most.

**`claude-cli-acp` has not been observed reporting anything.** Its single
run since the feature landed failed. The table's entry for it — cost,
tokens and a per-model split — is derived from `claude`'s documented
stream format and from unit tests, not from a live run. That is a
reasonable expectation, and it is not the same as a measurement, and the
document does not currently distinguish the two.

A reader deciding whether their ceiling protects them cannot act on
"reports what it sends".

## What Changes

- `LIMITS.md`: say for each agent whether its reporting is measured or
  expected, and — where measured — which ceiling can act on it.
- State outright that a run that fails may record nothing, since a
  reader may reasonably expect a failed run's spend to still count
  against a ceiling.

## Capabilities

### Modified Capabilities

- `execution-core`: what the system tells a person about a ceiling's
  reach distinguishes what has been observed from what is expected.

## Impact

- `LIMITS.md` only. No behaviour changes, no code changes, no changeset.

## Explicitly out of scope

- **Making Copilot report a cost.** It sends what it sends; ADR 0017
  forbids deriving a figure from a price table, and nothing here invents
  one.
- **Recording usage for a failed run.** Whether an agent that fails
  mid-turn could still report a partial figure is a question about the
  adapters, not about this document. Today it records nothing, and this
  change says so rather than changing it.
- **Re-testing `claude-cli-acp` to settle its row.** That needs a real
  run, which is a human-only step already outstanding in
  `usage-from-acp`. This change marks the row honestly until then.
