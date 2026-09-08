# Design

## Context

Read on 2026-09-08.

- `HARNESS_AGENT_CAPABILITIES` (`harness-step-agent.ts`) records, per
  agent id, the `effort` values its command line accepts and which
  `budgetField` it honours. Both describe what can be **sent** to the
  agent.
- Nothing records what an agent **reports back**. `LIMITS.md`'s "Which
  agents report usage" table is the only place that exists, in prose,
  with its evidence column marked *Measured* or *Unobserved*.
- `checkBudget` compares recorded usage against `budget`; usage absent
  means nothing to compare, and it fails open.
- `timeout` (from `run-has-a-time-limit`) needs no report and applies to
  every agent.

## Decision: what an agent reports becomes a capability

A third field beside `effort` and `budgetField`, in the same table, for
the same reason that table exists: one source of truth that the
configuration validator, the settings surface and the documentation all
read, rather than three that drift.

The values have to carry the difference `LIMITS.md` already draws:

- **cost and tokens** — `claude-cli-acp`, measured.
- **tokens only** — `copilot-cli-acp`, measured: 786,966 in, 4,732 out,
  1,308 thought, and no cost field of any kind.
- **nothing** — the six raw-text agents and `vscode-chat`. Certain, not
  measured: plain text carries no figure to record.
- **unknown** — `gemini-cli-acp` and `codex-cli-acp`, never observed
  here. Distinct from "nothing" on purpose.

The fourth value is the one that keeps this honest. Recording an
unobserved agent as reporting nothing would produce a confident warning
about a fact nobody has checked, which is worse than saying so.

## Decision: it reports what cannot happen, not what to do

Every finding is of one shape: *this setting cannot act, and here is
why*. It never suggests a value.

That boundary is what keeps this change small and its output
trustworthy. "`maxCostUsd` cannot fire on `copilot-cli-acp`" follows from
one recorded fact. "Set it to $8" needs a history, a notion of similar
changes, and a judgement about the operator's tolerance — the change
after the templates, which will read the report from
`what-a-change-cost`.

## Decision: the stage with no bound at all is the finding that matters most

The individual warnings are useful. The one that changes behaviour is the
summary: *this stage can run without limit* — reached when the stage's
agent reports nothing and no `timeout` is configured.

Before `run-has-a-time-limit` there was no answer to that at all. Now
there is one, and the finding names it: a time ceiling needs no report
and is the only bound that applies to a silent agent.

## Decision: shown where the configuration is chosen

On the settings surface, not behind a command. A warning a person has to
ask for is a warning read by someone who already suspects the problem,
which is precisely the reader who did not need it.

The command exists as well, because the configuration can be edited as
JSON by hand — `HARNESS.md` says outright that some settings have no
control in either host — and a person doing that has no settings screen
open.

## Decision: reported, never refused

A configuration whose ceiling cannot fire stays valid. An operator may
knowingly set a cost ceiling that binds three stages of four and accept
the fourth as unbounded; refusing it would trade a real use for a
judgement that is theirs.

This differs from the pairs that *are* refused — `maxStageSeconds` above
`maxRunSeconds`, a budget field the agent's CLI does not accept — and the
difference is worth stating: those are self-contradictory as written,
where this one is merely narrower than its author may have assumed.

## Rejected: deriving the reporting behaviour at runtime

The product could record what each agent actually reported and learn from
it. That would be accurate and useless at the moment it is needed: the
warning has to appear when the configuration is being written, which is
before any run under it exists.

## What this does not decide

Whether the settings surface should offer to fix a finding — switch the
agent, or add the timeout that would bound it. That is one step from
recommending a value, and it belongs with the change that earns the right
to recommend.
