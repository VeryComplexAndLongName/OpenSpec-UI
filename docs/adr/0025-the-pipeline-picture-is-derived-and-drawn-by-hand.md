# 0025: The Pipeline Picture Is Derived, and Drawn Without a Graph Library

Status: Accepted

Date: 2026-09-11

## Context

ADR-0024 established that whether two changes can run side by side is
derived from what the repository already contains, never declared: from
`blocked_by`, from two deltas naming the same capability, and from two
branches having changed the same file. `change-readiness.ts` produces
that report, and `openspec-ui-cli ready` prints it.

The owner asked on 2026-09-11 for the same thing as a picture — "граф с
ченджами, которые идут, а могут параллельно", laid out the way a CI
service draws a pipeline, in a tab of its own — and, after a review of
multi-person use, for it to show who is implementing each change.

Two questions arise that a list never had to answer. Where does each
node go? And what is drawn between them?

The tempting answer to the first is a layout library — dagre, elk, or a
whole diagramming component. The tempting answer to the second is "every
relation we know about", which would put a line between two changes that
collide.

## Decision

**The layout is derived from the readiness report, in core.**

A change's column is its depth in the `blocked_by` order: a change with
no blockers is column 0, and a change's column is one past the deepest
change it is blocked by. Order within a column is by change name, so the
picture is stable between reads — a node that moves when nothing changed
reads as something having happened.

This lives in `packages/core` beside the report it is computed from, not
in the view. The CLI and the shell then place changes identically,
because there is one placement. A second implementation in the browser
would be free to drift, and the drift would be invisible: both pictures
would look plausible.

**Collisions are not edges.**

`blocked_by` is an order: A before B, and an arrow means exactly that.
A collision is not an order — two changes that would meet in one spec
file have no precedence between them, and either may go first. An edge
between them would assert a sequence the repository does not contain,
and a reader would believe it, because it would look like every other
edge in the drawing.

So a collision is shown on the node it affects, as text, naming the
other change and the reason. The `ready` command already reports them
this way ("not with beta — both deliver a delta to ci-cli"), and the two
surfaces should not describe the same fact differently.

**The drawing is DOM nodes in a CSS grid, with an SVG overlay for
edges.**

No graph library is added. The reasons are specific rather than general:

- The layout is already decided by the time the view runs, so what a
  layout library would contribute is the part this ADR puts in core.
- A node must be a real focusable element with real text: this shell is
  held to WCAG AA by a browser suite that runs axe on every screen
  (ADR-0016's descendants), and a canvas or an SVG-only rendering makes
  every node something that has to be given an accessible name by hand.
  A `<button>` in a grid cell already is one.
- `packages/webui` leaf modules are kept browser-safe and the bundle is
  checked; adding a dependency for a drawing this size is a cost that
  arrives on every page load.

SVG carries only the edges, positioned from the nodes' measured
geometry, and is marked `aria-hidden`: the relation an edge draws is
already stated in words on the node it points from, so the picture adds
nothing for a reader who cannot see it, and would only repeat itself.

## Consequences

The picture cannot disagree with `openspec-ui-cli ready`, because both
read one report and one layout.

A cycle in `blocked_by` has no depth. It is reported as such rather than
drawn, because a drawing that silently placed a cycle somewhere would be
a wrong answer that looks like a right one.

Edges must be positioned after layout and repositioned on resize, which
is work a library would have done. It is bounded work — measure the
nodes, draw a path between two rectangles — and it is the price of the
three reasons above.

A very wide repository (many independent changes) makes a wide picture.
It scrolls horizontally in its own container, which the shell already
does for tables and code blocks.

## Alternatives considered

**A graph library.** Rejected above: it solves the part already solved
in core, and costs the part that matters (accessible nodes, bundle
size).

**Drawing collisions as dashed edges.** Rejected: a reader distinguishes
solid from dashed only if told to, and the thing being distinguished is
"this is an order" from "this is emphatically not an order". Too much
meaning on a line style.

**Layout in the view.** Rejected: two implementations of one placement,
drifting invisibly.

**A Gantt chart.** Rejected: it would need durations, which do not
exist. The repository knows order, not time. `MultiChangeTimelineView`
already shows what is known about time and is not this.
