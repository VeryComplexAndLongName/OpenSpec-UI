# A graph of what is running

## Why

Changes can run side by side. Which ones may is already decided, and
already answerable: `blocked_by` states an order, `change-readiness`
derives collisions, and the workspace lease says what is running right
now and — since `a-lease-says-who` — whose run it is.

All of that is only readable as a list. `openspec-ui-cli ready` prints
three headings; the shell shows changes as rows. Neither shows the
*shape* of the work: that four changes are waiting on one, that two of
the ready ones cannot start together, that the thing everything is
queued behind is the one nobody is running.

A list answers "what is the state of this change". A picture answers
"where is the work" — which is the question somebody asks when they
open the tool having been away, or when two people are deciding what to
pick up.

Sequential work is not a separate thing to draw. A chain of changes each
blocked by the previous is a graph one lane wide; independent changes
are lanes side by side. One drawing covers both, which is why this is a
graph and not a Gantt chart or a second list.

## What Changes

- A **Pipeline** tab in the shell: every active change as a node, laid
  out in columns by how deep it sits in the `blocked_by` order, with
  edges drawn for declared blockers.
- Each node carries its state — running, ready, blocked — and a running
  node names who is implementing it, from the lease's git author.
- Collisions are **not** drawn as edges. Two changes that would collide
  are not in an order; drawing a line between them would say they were.
  They are shown on the node that is affected, as the reason it cannot
  join something else.
- `change-readiness` reaches the shell: a server endpoint, an extension
  bridge message, and a client.
- Nothing new is computed for the picture. Every fact it draws is one
  `change-readiness` already derives (ADR 0024), so the tab and
  `openspec-ui-cli ready` cannot disagree.

## Impact

- `packages/core` — the readiness report gains a layout that is derived
  from it, so the CLI and the shell place changes identically.
- `packages/server`, `packages/extension` — one endpoint and one bridge
  message each, carrying the report that already exists.
- `packages/webui` — a new tab, a new component, and its stylesheet
  layer.
- No new dependency. See the design note on why the drawing is DOM and
  SVG rather than a graph library.
