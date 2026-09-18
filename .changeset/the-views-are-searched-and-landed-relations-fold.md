---
"@openspec-ui/core": minor
"@openspec-ui/webui": patch
"openspec-ui-vscode": minor
---

The Archive, Specs and Change Graph views can be narrowed, and the graph
folds what has landed

Asked for by DW: a search box beside Archive, Specs and the Change Graph,
and a way to hide the parts of the graph where every change has landed.
269 archived changes and two finished clusters were in the way of the part
being decided.

Each of the three views takes a filter from its title bar: an input box
seeded with what the view is already narrowed by, every typed word having
to appear somewhere in the row. A narrowed view says what it is narrowed
by and how much of itself it is showing, and a view filtered to nothing
says so with the words it was given rather than looking like a workspace
with nothing in it.

The Change Graph folds every branch whose root and every change under it
are archived, and ends its roots with a row reading "N landed relations
hidden" that shows them when pressed; the title bar offers Show and Hide
in turn. Two branches stay drawn whatever the fold says: one a live change
follows, since the parent is the reason that change exists, and one a live
change is waiting on, since a row reading "waiting on base" needs a base
to point at. A filter that finds something inside a folded branch unfolds
it for the reading.

The predicate itself is core's `matchesFilter`, which the standalone lists
now call instead of their own copy, so a word that finds a change in one
host finds it in the other. `landedBranches` reads the `follows` relation
and says which branches have finished.
