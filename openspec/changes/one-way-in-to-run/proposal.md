# One way in to a run

## Why

There are two menu entries for starting work on a change, and which one
a person wants is not answerable from their names.

In VS Code: **Run with Agentic Harness** resolves the change's
configuration and opens the panel it points at — the single-stage picker
for `assisted`, the chain panel otherwise. **Implement with VS Code
Agent** ignores the configuration entirely and opens VS Code Chat in
agent mode with a built prompt.

In the standalone UI the same split appears as a tab and a button, and
the button sometimes just switches to the tab.

So the choice a person actually faces — *who does this work, and how much
of it without me* — is spread across two entries and a configuration file
that one of them does not read. Picking the wrong entry is not visibly
wrong: `Run with Agentic Harness` on an `assisted` change looks like it
did nothing except change tabs.

Reported by the owner on 2026-09-08, after the same confusion produced
two buttons sharing a label a day earlier.

## Capabilities

### Modified

- One entry starts a run, and it shows what the configuration says before
  starting.

### Removed

- The second entry. `Implement with VS Code Agent` becomes a choice
  inside the one dialog, not a separate way in.

## Out of scope

Changing what any of the three paths do once started. This is about which
one runs and how that is decided, not about the chain, the picker or the
VS Code Chat prompt.
