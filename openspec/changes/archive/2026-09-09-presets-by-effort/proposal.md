# Named configurations differ by effort, not by model

## Why

The three named configurations differ by model and by ceilings. One of
them pins `claude-sonnet-5` on every stage, which means applying it
discards whichever model the workspace's own base configuration chose —
and the product cannot check that any model name it ships is one the
CLI will accept, because neither CLI has a command that lists them.

What the product *can* control honestly is effort. Every agent that
accepts one declares which values it takes, so a configuration that asks
for "the highest this agent accepts" is always expressible and never
stale.

So: four configurations differing by effort and ceilings, and the model
is whatever the person already configured. Said outright, in the
configuration's own text and in the documentation, so nobody has to
deduce it.

## Capabilities

### Modified

- The named configurations differ by effort level, and set no model.
- A configuration's effort is resolved against the agent it is applied
  to, rather than stored as a value that agent may not accept.

## Out of scope

Custom. It is the fifth entry a person picks and it needs somewhere to
remember what they chose; that store is its own decision and its own
change.

## A cost worth stating

This is the third renaming of these configurations in two days. The
article and the captured screenshot move with it again. The axis is
right this time for a reason the previous two were not: it is the only
one the product can honestly hold, because effort is the only one it can
check.
