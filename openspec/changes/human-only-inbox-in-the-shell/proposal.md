# What is waiting on a person, in the shell as well

## Why

A change with one unticked human-only item is `in-progress` with a task
open. So is a change nobody has started. In a list of changes they are
the same row.

That is not hypothetical. On 2026-09-09 this repository had six changes
in exactly that state — implemented, merged, waiting on a live check —
and the question came back as "six changes not started, is that
deliberate?". Answering it took reading six task files.

The editor host has answered this since `human-only-inbox`. The shell has
not, and the loop that collects the answer lives inside a VS Code tree
rather than anywhere both hosts can reach it.

## Capabilities

### New

- What is waiting on a person is readable in the standalone shell, beside
  the summary that raises the question.

### Modified

- The collecting is done once, in `core`, and both hosts read it.

## Out of scope

Ticking an item from either surface. `human-only-inbox` decided that
deliberately — nothing in the inbox marks an item done — and this
inherits it: the point of a human-only item is that a person did the
thing, and a button that says they did is a button for lying.
