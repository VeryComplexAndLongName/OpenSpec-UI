# Design

## Decision: the axis is cost and time, because that is what is being chosen

The three configurations become **Minimum cost**, **Balanced** and
**Fastest**.

The configurations themselves do not change. Their ceilings were measured
against this repository's audit log in `settings-templates` and that
measurement stands. What changes is the axis they are presented on:
supervision style was a consequence of each choice, and cost and time are
the choice.

## Decision: "Fastest" says what makes it fast, because it is not the agent

Nothing here makes an agent work faster. Naming a configuration "Fastest"
without saying what it actually does would promise a lever the product
does not have — the same defect as a template promising "no checkpoints"
and not setting them, which this repository shipped and fixed on the same
day.

Two real levers exist, and Fastest uses both:

- **It does not wait for a person.** A chain that pauses between stages
  spends most of its wall-clock waiting for someone to come back. Removing
  the pauses is the single largest reduction in time-to-finish available,
  and it is a configuration setting rather than a wish.
- **Its ceilings are generous enough not to cut a stage.** A stage cut at
  a ceiling is retried from the start, so a tight ceiling makes a run take
  longer, not shorter. Its stage ceiling sits above the longest run this
  repository has recorded.

So its `basis` says outright: this does not make the work faster, it stops
the run waiting and stops it being restarted.

## Decision: the figures move into the title

Each title carries its ceilings — "Minimum cost · up to $3, 45 min" —
rather than leaving them to a sentence three lines down.

The figures are the axis. A list whose titles omit them makes a reader
open each one to compare the thing they are comparing on.

## Rejected: a fourth configuration for "fast and cheap"

There is no such setting. Cheap comes from a smaller model, which needs a
second attempt more often, and a second attempt costs time. Offering the
combination would name a trade the product cannot make.

## Rejected: keeping the old names as aliases

Nothing stores a template by id — applying one copies its configuration —
so an alias would preserve a name no file refers to, at the cost of two
names for one thing in every list.

## Consequence: only two are offered globally

Fastest sets `autonomyLevel: "autonomous"`, which a global file refuses,
so it stays per-change. That was already true of Overnight and is
unchanged; it is stated here because the new name makes the absence more
conspicuous.
