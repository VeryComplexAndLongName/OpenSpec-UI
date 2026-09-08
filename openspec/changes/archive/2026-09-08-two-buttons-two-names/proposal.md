# Two buttons, two names

## Why

The standalone UI shows two buttons labelled "Run with Agentic Harness",
one directly above the other, and they do different things.

The first resolves the change's harness configuration and dispatches:
`assisted` switches to the single-stage picker, anything else reveals the
chain panel below. The second, inside that panel, starts the chain.

The second label predates the first. When the chain panel was the only
way in, "Run with Agentic Harness" was the accurate name for its button;
the dispatch entry added later took the same words, and nothing noticed
that both were now on screen together.

A person cannot tell from the labels which one they want, and clicking
the wrong one is not obviously wrong — the first appears to do nothing
when the panel is already open.

Reported by the owner on 2026-09-08.

## Capabilities

### Modified

- The button that starts a chain is named for starting a chain.

## Out of scope

Renaming the dispatch entry. It matches the VS Code command
`openspec-ui.runWithHarness` that people already know, and it is the
entry point; the inner button is the one whose name was inherited rather
than chosen.
