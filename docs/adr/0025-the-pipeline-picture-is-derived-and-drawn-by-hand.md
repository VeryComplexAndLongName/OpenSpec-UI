# 0025: The Pipeline Picture Is Derived, and Drawn Without a Graph Library

Status: Accepted

Date: 2026-09-11

## Context

ADR-0024 established that whether two changes can run side by side is
derived from what the repository already contains, never declared: from
`blocked_by`, from two deltas naming the same capability, and from two
branches having changed the same file. `change-readiness.ts` produces
that report, and `openspec-ui-cli ready` prints it.

The owner asked on 2026-09-11 for the same thing as a picture — a graph
of the changes that are running and the ones that could run alongside
them, laid out the way a CI service draws a pipeline, in a tab of its
own — and, after a review of multi-person use, for it to show who is
implementing each change.

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

**The geometry is derived in core too, so nothing is measured.**

The layout returns coordinates, not just an ordering: each node's
position and size, and each edge's path, in abstract units. A node is an
absolutely positioned control at `calc(var(--u) * x)`; the edges are one
SVG whose `viewBox` is in the same units and whose rendered width is the
same multiple of `--u`. One unit means one thing in both, so they line
up without either being asked where the other ended up.

The alternative was to lay nodes out with CSS and measure them —
`getBoundingClientRect` per node, a `ResizeObserver`, and a re-run of
the overlay after every layout pass and after fonts settle. That is the
only part of this view that would have held state derived from a moment
of rendering, the only part not checkable without a browser, and the
only part with a failure mode that looks fine: an edge positioned from
stale geometry is a line pointing at nothing.

Deriving the coordinates instead makes edge placement exactly as
testable as the ordering it comes from, in the same unit tests, with no
DOM at all.

`--u` is a `rem`, and not an `em`, for two reasons that both bite. A
custom property holds a token rather than a computed length, so `1em`
would resolve against the font size of whichever element used it — a
card that set its own font size would move. And the shell fixes `body`
at 14px, so an `em` inside it does not follow the reader's browser font
setting at all. A `rem` does, which is the thing that was wanted.

The cost is that a node card has a fixed size, and text longer than it
is truncated with the full text available on the element. That is what
a pipeline node looks like anyway, and the change name — the part a
reader scans for — is the part that gets the room.

**Nodes are DOM controls; SVG carries only the edges.**

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

The SVG is marked `aria-hidden`: the relation an edge draws is already
stated in words on the node it points from, so it adds nothing for a
reader who cannot see it and would only repeat itself.

**Below 720px the picture becomes a list.**

Four columns of cards do not fit a phone, in any implementation. Rather
than shrink until it is technically present and practically unreadable,
the same nodes render as headed lanes — "can start now", then what
follows — each stating in words what it waits on. Nothing is lost: that
wording is what the edges were an illustration of, and is already what
the picture offers a screen reader.

## Consequences

The picture cannot disagree with `openspec-ui-cli ready`, because both
read one report and one layout.

A cycle in `blocked_by` has no depth. It is reported as such rather than
drawn, because a drawing that silently placed a cycle somewhere would be
a wrong answer that looks like a right one.

Edge routing is now arithmetic this project owns, which is work a
library would have done. It is bounded — a path between two rectangles
whose coordinates are already known — and it is checked by the same unit
tests as the ordering.

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

**CSS-only connectors, no SVG at all.** Rejected on a concrete ground: a
change is placed one past its *deepest* blocker, so an edge can skip a
column — a change blocked by one thing at depth 0 and another at depth 1
sits at depth 2 and has an edge spanning two columns. Borders on
pseudo-elements draw a neighbour-to-neighbour connector well and that
one wrong.

**Measuring the laid-out nodes.** Rejected above: the only state derived
from a moment of rendering, the only part needing a browser to check,
and a failure mode that looks fine.

**A Gantt chart.** Rejected: it would need durations, which do not
exist. The repository knows order, not time. `MultiChangeTimelineView`
already shows what is known about time and is not this.
