# Design

## Context

Measured on 2026-09-08 from this repository's own `.openspec-ui/audit.jsonl`,
read through `buildChangeCostReport`:

| | Runs | Median | p75 | p90 | Largest |
|---|---|---|---|---|---|
| Duration | 49 | 7.7 min | 19.7 min | 34.9 min | 56.8 min |
| Cost | 16 | $1.94 | — | $7.14 | $8.67 |

Sixteen of forty-nine runs reported a cost at all; the rest ran on agents
that report nothing.

Also relevant, and both recent:

- `HARNESS_AGENT_CAPABILITIES.reports` says what each agent reports back,
  so a ceiling that cannot act is detectable.
- `findHarnessConfigLimits` turns that into findings over a resolved
  configuration.
- Three settings — `autonomyLevel: "autonomous"`,
  `reviewGate.mode: "agent-sufficient"`, and
  `checkpoints.requireConfirmationBetweenSteps: false` — are refused in a
  global file and valid only per change.

## Decision: a template is checked against the diagnostic

Every template must produce **no findings** from
`findHarnessConfigLimits`, and a test asserts it for each template.

This is what separates a template from a suggestion. A named "overnight"
setting that paired a cost ceiling with an agent reporting no cost would
be shipping the exact confusion the diagnostic exists to report — and
worse, with the product's own name on it.

The check is cheap because both pieces already exist. It also means a
template cannot rot: if an agent's reporting is later measured and the
recorded capability changes, any template that depended on the old
understanding fails the build.

## Decision: the numbers are measured where they can be

A stage ceiling of ten minutes is the number a person reaches for, and it
would have cut nearly a third of the runs in this repository. That is the
argument for measuring rather than choosing.

So the ceilings come from the distribution, and each template says which
percentile it sits at:

- **Careful** — stage 20 minutes (p75: cuts the slowest quarter), run 60
  minutes, cost $5 (above the median run, below p90).
- **Overnight** — stage 60 minutes (above the longest run observed), run
  4 hours, cost $25 (roughly three p90 runs).
- **Cheap** — stage 20 minutes, run 45 minutes, cost $3 (above the
  median, well under p90).

Where a number is judgement rather than measurement it says so. "Four
hours" is not in the data; it is a decision about how long an unattended
run may go before someone should look.

## Decision: templates state their scope

A template that sets `autonomyLevel: "autonomous"` cannot be applied
globally — the write would be refused. So each template declares whether
it is for the global file, a change, or either.

The alternative, silently dropping the fields that are not allowed, would
give a person a template that behaves differently depending on where they
clicked it, which is worse than not offering it there.

## Decision: described by intent, and by when not to use it

Each template carries a sentence about what it is for and a sentence
about when it is the wrong choice. The second is the useful one — a list
of options with only advantages is a list that gives no help choosing.

"Overnight" says outright that it will spend up to $25 without asking.
"Cheap" says it uses a smaller model and will more often need a second
attempt. That is what someone needs in order to pick.

## Decision: no template sets an agent that reports nothing

Every template names agents that report their usage, so its ceilings can
act. Not because the other agents are worse, but because a template's
promise is a coherent configuration, and a spending ceiling over a silent
agent is not one — only its timeout would bind.

A person choosing such an agent by hand still gets the diagnostic's
warning; this is about what the product proposes in its own voice.

## Rejected: deriving the templates from the audit log at runtime

Reading the distribution live and setting ceilings from it would be more
accurate for a repository with history, and useless for the case
templates exist for: the first run in a new workspace, where there is no
history at all.

Measured constants, with the measurement recorded, work in both.

## Rejected: one template that adapts

A single "recommended" setting that changed shape with the situation
would hide the choice being made. Three named intents make the trade
visible: a person picking "cheap" knows they are trading attempts for
money, because the template says so.

## What this does not decide

Which template suits a given change. That reads the change's own history
through `buildChangeCostReport` and is the next change; this one supplies
what there is to recommend.
