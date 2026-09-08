## Why

Three named configurations now exist, and nothing helps a person pick
between them.

That was the plan's next step, and it was going to be "recommend a budget
from what comparable changes actually cost". Measuring the history this
would read says that cannot be done honestly.

Counted on 2026-09-08 across this repository's own audit log — 22 changes
with any record at all:

| | |
|---|---|
| Changes with exactly one recorded run | **13 of 22** |
| Changes with no run that reported a cost | **16 of 22** |
| Changes with three or more cost figures | **2** |

A recommendation of "$8 for this change" drawn from one observation, or
from none, is a confident number with nothing behind it — and it would be
believed, because it looks computed. That is worse than no
recommendation, and it is the failure this project has already named
twice: a figure absent is not a figure of zero, and a ceiling that cannot
act must say so rather than look like one that has not fired.

What the data does support is narrower and still useful.

**Pooled across the repository**, there is enough: 49 runs with a
duration and 16 with a cost, which is where the templates' own ceilings
came from. And choosing between three named intents needs far less
evidence than proposing a number — the question is which of three, not
how many dollars.

So: recommend a **template**, from what is knowable about the change
itself, and say what the recommendation was based on — including when
that is very little.

## What Changes

- A recommendation of one named configuration for a given change, with
  the reasons it was chosen shown alongside it.
- The reasons are drawn from what the change actually says: how many
  tasks it has, how many remain, whether it has run before and how that
  went.
- Where there is little to go on, the recommendation says so plainly
  rather than presenting a default as a finding.
- No figure is ever invented for a change from its own thin history.

## Capabilities

### Modified Capabilities

- `agentic-harness`: a change can be told which named configuration suits
  it, and on what grounds.

## Impact

- `packages/core`: a function over a change's task list and its recorded
  history. `packages/webui`'s settings view. Changeset for `core` and
  `webui`.

## Explicitly out of scope

- **Recommending a number.** The measurement above is the reason. A
  per-change cost ceiling drawn from one observation would be arithmetic
  dressed as evidence.
- **Applying the recommendation automatically.** It fills the form on
  request, like a template. A configuration a person did not choose is
  one they cannot be expected to understand when it acts.
- **Learning from outcomes over time.** Adjusting a recommendation
  because a previous run overran is a feedback loop with its own failure
  modes, and it needs history this repository does not yet have.
