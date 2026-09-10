# What the verifying stages found, beside what the runs cost

## Why

`verify-records-what-it-found` started writing `checksRan` and
`checksFailed` into the audit log. Nothing reads them.

The workspace already reports what runs cost, per agent and per effort.
That is half the question a person asks before choosing one: an agent
that is cheap and fails its checks is not the cheap one, and today the
log knows which is which while no surface does.

Measured on this repository 2026-09-10: **0 of 108 audit entries carry
these fields**, because no chain has reached a verifying stage since the
recording landed. So this ships showing nothing, and says which nothing
it is — a log with no runs and a log whose runs never verified are
different facts, and only one is fixed by running something.

Building the readback now rather than the day data appears is deliberate:
the day it appears is the day it is worth reading.

## Capabilities

### New

- What the verifying stages found is readable per agent, beside what the
  runs cost, with the same threshold discipline the cost figures use.

## Out of scope

Per effort. The cost figures group that way because effort is what a
person sets; whether a check passes is more about the change than the
dial, and a second grouping over data that does not exist yet would be
two empty tables instead of one.

Naming which checks failed. The audit entry records how many, not which.
A view that named them would be inventing the field it reads.
