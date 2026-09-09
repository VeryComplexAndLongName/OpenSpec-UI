# What runs cost in this workspace

## Why

The recommendation reads two things: how many tasks a change has left,
and whether its own previous run hit a ceiling. Everything else the audit
log knows — what a run cost, how long it took, whether it finished, on
which agent at which effort — is written and never read back in
aggregate.

That was the right narrow start. It is now the reason the run dialog
cannot answer the question a person actually has: *what does this
usually cost here, and what should I pick?*

Measured 2026-09-09 on this repository's own log: 108 entries, 40 paired
runs, 16 with a recorded cost. Grouped by agent that is a usable corpus.
Grouped by (agent, effort) it is not — **effort is known for one run in
forty**, because the field landed two days ago.

So this aggregates by agent now and by effort when there is enough, and
says which of the two it is doing.

## Capabilities

### New

- What runs have cost in this workspace, read back from the audit log:
  per agent, and per effort where enough has been recorded.
- A statement of how much the figures rest on, shown with them.

### Modified

- Runs against a change that no longer exists are excluded from
  aggregates.

## Out of scope

The dialog that will show this. This change produces the numbers and the
statement about them; where they appear is the next one.

Recommending a configuration from these figures. That needs the numbers
to exist first, and it needs a rule for turning them into a proposal
which is worth its own argument.
