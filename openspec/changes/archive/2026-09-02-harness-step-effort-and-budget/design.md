## Context

See `proposal.md` for the per-agent investigation. Facts read from the
code:

- `HarnessStepAgent = string | { agent: string; model?: string; dispatch?:
  HarnessStageDispatch }`, in a leaf module with zero non-type imports
  because `normalizeStepAgent` is re-exported as a **value** through
  `@openspec-ui/core/browser`.
- `MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/` — an allow-list of
  characters, chosen so a value can never start with `-` and be read as a
  second flag.
- `exactWithOptionalModel(expected, modelFlag)` admits the expected argv,
  or the expected argv plus exactly two more elements: the model flag and
  a value matching `MODEL_ID_PATTERN`.
- `harness-config.ts` deep-merges the global file with a per-change one,
  and rejects specific values in the global file by name
  (`GlobalAutonomousAutonomyLevelError`,
  `GlobalCheckpointsDisabledError`).

## Goals / Non-Goals

**Goals:**

- Set reasoning effort and a spending cap per stage, in both
  configuration files.
- Keep the allowlist a closed, pre-approved argv shape.
- Make an agent that cannot honour a setting say so.

**Non-Goals:**

- One portable value space across agents. The CLIs do not have one.
- Converting between spending units.
- Replacing this project's own stage-boundary budget.

## Decisions

### Effort is validated per agent, not against one shared union

The configuration carries a value from the union of everything any agent
accepts; each adapter declares the subset it takes, and a value outside
that subset is refused when the configuration resolves — before a run
starts.

**Rejected alternative**: one shared union, taken as the intersection of
all agents (`low, medium, high, xhigh, max`). Rejected — it would silently
make `none` and `minimal` unavailable for `copilot-cli`, which does accept
them, in order to satisfy an agent the user may never select.

**Rejected alternative**: a free string, validated only by
`MODEL_ID_PATTERN`'s character rules. Rejected — the value space here is
five to seven known words. A closed set catches `hihg` at configuration
time; a character class passes it to the CLI and the run fails minutes
later with the CLI's own error, or worse, silently ignores it.

### An agent that cannot express a setting refuses it

`gemini-cli` has no command-line effort flag. Configuring one for a
`gemini-cli` stage is an error at configuration-resolution time, naming
the agent and the setting.

**Rejected alternative**: ignore the setting for agents that lack it.
Rejected — the user sets `effort: "high"`, pays for a run that had no
elevated effort, and never learns the setting did nothing. Silence here is
the worst of the three options; refusing is the only one that tells the
truth.

### `codex-cli`'s config override is admitted for exactly one key

`codex` expresses effort as `-c model_reasoning_effort="<level>"` — a
generic configuration override. The adapter renders that and only that
key, and the allowlist matches the whole pair including the key name.

**Rejected alternative**: admit `-c <key>=<value>` generally. Rejected —
`-c` reaches codex's entire configuration surface (sandbox mode, approval
policy, provider). Admitting the flag rather than the specific setting
would turn one narrow feature into a hole in the argv allowlist, which is
this project's actual security boundary.

### Budget values are agent-native and named for their unit

`maxCostUsd` for `claude-cli`; `maxAiCredits` for `copilot-cli`. No shared
`budget: number`.

The field name carries the unit, and the set of units is whatever the
agents themselves offer — not a list this project invents. An agent that
one day caps in euros gets its own field named for euros, alongside the
others rather than instead of them, and the agents that do not honour it
reject it through the same validator as every other mismatched field.

**Rejected alternative**: one `budget` field each adapter interprets in
its own units. Rejected — the same number would mean 5 dollars for one
agent and 5 credits for another, and a user moving a stage between agents
would change the cap by an unknown factor without touching it.

**Rejected alternative**: one field in dollars, converted per agent.
GitHub does publish a rate — one AI credit is $0.01 USD — so unlike the
token pricing ADR 0017 rejected a table for, this conversion is available
rather than invented. Rejected anyway, on three grounds that survive the
rate existing:

- The rate is a vendor product decision, not a constant. If it changes, a
  configuration that says `maxCostUsd: 5` silently starts meaning a
  different cap, and nothing in this repository would notice.
- The abstraction leaks at once: `--max-ai-credits` has a minimum of 30
  credits, so a dollars field would still have to reject values under
  $0.30 for one agent and not for another. A portable field that is not
  portable at its own boundary is worse than two honest ones.
- Rounding has a direction. $5.005 is 500.5 credits; rounding up exceeds
  the cap the user wrote, rounding down silently tightens it. Neither is
  a decision this project should make on the user's behalf.

The user's own steer on 2026-09-02 was the same: caps belong in the units
of the agent being used.

### The allowlist grows to a set of validated optional pairs, still closed

`exactWithOptionalModel` becomes a matcher taking the expected prefix plus
a table of permitted optional pairs — flag name to value validator. Order
between optional pairs is fixed by the adapter that renders them, and the
matcher requires that same order.

**Rejected alternative**: accept the optional pairs in any order.
Rejected — an order-insensitive matcher is a larger surface to reason
about for no gain: exactly one caller builds this argv, and it builds it
in one order.

**Rejected alternative**: drop to a looser check now that argv has grown.
Rejected — the allowlist is the boundary that made this change necessary
in the first place, and its value is precisely that it is closed.

## Risks / Trade-offs

- **[Risk]** `codex-cli` and `gemini-cli` behavior is taken from upstream
  documentation, not from this machine — neither binary is installed
  here. → **Mitigation**: their adapters' tasks are gated on live
  verification before being marked complete, the same way ADR 0013
  handled `gemini --experimental-acp`. Until then `codex-cli` renders
  nothing and `gemini-cli` refuses, which is the safe direction for both.
- **[Risk]** A CLI's own budget flag and this project's stage-boundary
  budget can disagree, stopping a run for one reason while the other
  thinks it has headroom. → **Mitigation**: they measure different things
  and are reported separately; a run stopped by the CLI's own cap ends
  through the adapter's normal failure path, with the CLI's own message.
- **[Trade-off]** Four adapters now differ visibly in what they accept.
  Accepted: that difference is real, and hiding it is what the rejected
  alternatives above each attempt.

## Migration Plan

Additive. Both fields are optional; an entry without them renders exactly
today's argv and matches the allowlist exactly as before. No existing
`agent-harness.json` or per-change `harness.json` changes meaning, and the
bare-string form of a stage entry keeps working.

## Open Questions

None. The two unverified agents are handled by gating rather than by
guessing.
