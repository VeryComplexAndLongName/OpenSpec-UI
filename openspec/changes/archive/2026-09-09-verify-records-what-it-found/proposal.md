# Verify records what it found

## Why

The aggregate can say what a run cost and how long it took. It cannot say
whether the work was any good, and the question a person actually has —
which agent produces work that passes — is the one it cannot answer.

Some of the answer is already computed and thrown away. `verify` runs
every mechanical check a change declares, learns how many passed and how
many failed, uses that to decide whether to invoke the verifying agent,
and then discards the counts. Nothing records them.

Worse, a `verify` whose checks failed records **nothing at all**: the
verifying agent never runs, so no audit entry is written, and the run
that found the most is the one that leaves no trace.

## Capabilities

### New

- What `verify`'s mechanical checks found is recorded, whether or not the
  verifying agent ran.

## Out of scope

Weighing what a review found. The interesting version of this question —
how many problems the verifying agent found and how serious each was —
needs the agent to report findings as data rather than as prose, and
nothing in this project asks it to. That is a protocol, and it is worth
its own argument.

Analysing what is recorded. Quality per agent needs the recording to
exist first, and then to accumulate: on 2026-09-09 the effort field, two
days old, covers one run in forty. This will start empty too, and saying
so is part of shipping it.
