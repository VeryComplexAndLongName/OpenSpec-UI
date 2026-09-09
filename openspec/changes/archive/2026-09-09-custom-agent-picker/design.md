# Design

## Context

`findCustomAgents(workspaceRoot, homeDir?)` reads `.claude/agents/*.md`
(project and user) and `.github/agents/*.md`, returning
`{ name, description?, family, filePath }` sorted by family and name. It
imports `node:fs/promises`, so the browser cannot call it — the same
shape as the run figures, which needed a route, a client and a component.

`customAgentFamilyFor(agentId)` and `agentsAcceptingCustomAgents()` are
already in a leaf module the browser bundle can import.

## Decision: one route, the whole list, no per-agent filtering server-side

`POST /api/custom-agents` returns every definition found, each carrying
its family. The browser filters by family per stage, because it already
knows which agent each stage uses and the answer changes as that select
changes — a round trip per keystroke would be a slower way to compute
what a two-line filter answers.

## Decision: the picker is a select, not a text field

A text field would accept any name, including one no definition matches,
and the CLI's error for an unknown agent arrives when the stage runs —
long after the mistake. A select can only produce a name that was found.

Where a workspace defines none for the stage's family, the select is not
rendered as an empty control. An empty dropdown is a promise of choice
that is not there; the section says instead that this workspace defines
none for that CLI, and where they would be read from.

## Decision: the stage's agent decides whether it is offered at all

A stage whose agent has no `customAgentFlag` gets no picker and a
sentence saying that CLI takes none. Offering a control whose value the
validator refuses is the ceiling-that-cannot-act defect wearing a
different hat.

## Decision: a missing definition stays visible until it is changed

A `harness.json` may name a definition that has since been deleted or
renamed. The select shows the configured name as its selected option even
when the discovery no longer finds it, marked as not found. Silently
resetting it to "none" would edit a person's configuration for them and
hide the fact that a file they depend on is gone.

## Rejected: reading the directories in the browser over the file API

The change editor's file routes are scoped to the workspace's own
`openspec` tree. Widening them to serve arbitrary dotfile directories to
the browser, to save one narrow route, trades a boundary for a
convenience.
