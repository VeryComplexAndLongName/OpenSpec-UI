# Design

See `docs/adr/0025-the-pipeline-picture-is-derived-and-drawn-by-hand.md`
for the decisions this change is built on: the layout is derived in
core, collisions are not edges, and the drawing is DOM plus an SVG
overlay rather than a graph library.

## Decision: one report, two surfaces

The tab draws `ChangeReadinessReport` and nothing else. It computes no
fact of its own — not "is this running", not "can these two go
together", not "what is this waiting on".

The reason is specific. `openspec-ui-cli ready` and this tab answer the
same question, and a second derivation would be free to drift from the
first. The drift would not announce itself: both surfaces would keep
looking plausible, and the one a person happened to be using would be
the one they believed.

So the report travels whole — a server endpoint, an extension bridge
message — and the layout is a pure function of it, in core.

## Decision: depth, not position

A node's column is its depth in the `blocked_by` order: zero where
nothing blocks it, otherwise one past the deepest thing it is blocked
by. Within a column, changes are ordered by name.

Ordering by name rather than by state is deliberate. Sorting running
changes first would move a node whenever a run started or ended, and a
node that moves reads as a change having been re-planned. The picture
should change where the repository changed.

## Decision: a cycle is reported, not drawn

`blocked_by` can contain a cycle — A blocked by B blocked by A. It is
already possible today and nothing rejects it.

A cycle has no depth, so there is no column to put it in. The layout
returns the cycle as a named list rather than choosing somewhere, and
the tab says so above the picture. A drawing that quietly placed one
would be a wrong answer that looks like a right one, and would be
believed for exactly as long as nobody checked.

## Decision: what a node says

- Its change name, as a control that opens the change.
- Its state: running, ready, or blocked.
- Running: where it is running and, where the lease recorded one, the
  git author of the run. Called "git author" and not "user", per
  `a-lease-says-who` — it is self-declared and nothing is gated on it.
- Blocked: what it is waiting on.
- Ready: what it can start alongside, and for each change it cannot
  join, that change and the reason. This is the collision, in words,
  on the node it affects.

## Decision: refreshed while visible, not while hidden

The lease heartbeat is five seconds and staleness is twenty, so a
picture older than that is misleading about what is running.

The tab polls while it is the active tab and stops when it is not.
Reading the report walks the changes directory and shells out to git,
which is not work to be doing behind a tab nobody is looking at. The
tab's content is not loaded at all until it is first opened, for the
same reason.

## Non-Goals

Editing the graph. `blocked_by` is stated in a change's own file, and a
picture that let it be dragged would be a second way to write something
the repository already has one way to write.

Durations, or anything time-shaped. The repository knows order, not
time; `MultiChangeTimelineView` covers what is known about time.

Archived changes. The question this answers is where the work is now.

Showing a person as anything but a git author. There is no identity
model here and this change does not add one.

## Risks / Trade-offs

Edge positions are measured from laid-out nodes, so they must be
recomputed on resize and after fonts settle. A stale edge is a line
pointing at nothing, which is worse than no line — so the overlay
renders from measured geometry on every layout pass rather than caching
it.

A repository with many independent changes draws wide. It scrolls in
its own container; the page body does not scroll sideways.

The report is a moment, not a subscription: between two polls a run can
start and finish. The tab shows when it last read, so a picture is never
presented as more current than it is.
