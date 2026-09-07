# Design

## Context

Read on 2026-09-07 from this repository. Line numbers are from that read.

- The Changes and Archive views already use `createTreeView`
  (`extension.ts:189-190`), so both already have `reveal`. The Change
  Graph uses `registerTreeDataProvider` (`:203`), which returns no
  handle, with a comment recording why: no command reads that view's
  selection.
- A graph row's identity is the path it was reached by, set explicitly:
  `this.id = [...ancestry, node.id].join(">")`
  (`change-graph-tree.ts:31`). A change reached through two parents is
  two rows with two ids.
- The graph's shape comes from `follows` alone (`childrenByParent`,
  `:135-146`); `supersedes` and `blocked_by` appear in a row's
  description and never nest.
- Only changes that state a relation, or have one stated to them, appear
  at all (`isConnected`, `:148-155`).
- Neither provider implements `getParent`, which `TreeView.reveal`
  requires.

## The numbers moved, and one of them was wrong

The proposal measured 4 of 15 active changes in the graph and 8 of 134
archived. Re-measured 2026-09-07, after twelve changes were archived on
the 6th and two more since:

| | In the graph | Total |
|---|---|---|
| Active | 1 | 2 |
| Archived | 14 | 149 |

The proportion is what the argument rests on, and it did not move: the
graph shows about a tenth of the repository's changes, because that is
what a relation view is for. Do not re-derive the argument from the
absolute counts, which change every time anything is archived.

One stated fact was wrong, in the direction that matters. The proposal
and task 2.2 say `load-variance-not-per-file-cost` occupies two rows. It
occupies **four**. The full set today:

| Change | Rows |
|---|---|
| `load-variance-not-per-file-cost` | 4 |
| `suite-survives-a-loaded-machine` | 3 |
| `every-varying-check-has-a-budget` | 3 |

Three changes, none of them with one row, and the largest twice the
number the tasks predict. Revealing "the" row would be wrong four times
over for the first of them.

## Decision: locating is a request; following is opt-in

Both commands are explicit actions. `followSelectionInChangeGraph`
defaults to `false`.

The reason is the table above and not caution. For a change the graph
does not show, a follow-the-selection behaviour has nothing to do; that
is the common case, not the edge case. A view that visibly does nothing
most of the time is indistinguishable from a broken one, and the reader
who concludes that stops trusting it in the tenth of cases where it
works.

Opt-in keeps the behaviour for readers whose work is in the connected
part of the graph, where it is useful most of the time.

## Decision: every row, and say how many

`TreeView.reveal` takes one element, so revealing "the change" is not
expressible. The command reveals each row for the change, selects the
first, and reports the count when it is more than one.

Choosing one row silently is the failure worth avoiding: a change has
several rows exactly because it follows several changes, so the
multiplicity *is* the information the reader came for. Reporting "shown
in 4 places" costs a notification and keeps it.

Rows are enumerated by walking `childrenByParent` from the roots, not by
inspecting what the tree has rendered. A collapsed subtree has no
rendered rows, and the reader who has collapsed everything is the one
most in need of being shown where a change sits.

## Decision: what `getParent` has to return

Task 1.2 says the provider must return "the same object identity VS Code
was given". That is stricter than the contract, and following it would
force a design the code does not need.

These items set `id` explicitly (`:31`), and a tree that sets `id` is
addressed by it: a freshly built item whose `id` is `a>b` names the same
row as the one VS Code rendered. Object identity is not the constraint —
the path is. What `getParent` must not do is return an item whose id is
merely *plausible*: rebuilding it from the change's own `follows` list
would produce whichever parent came first, which is a different row from
the one the reader is looking at when the change has several parents.

So the ancestry array a row already carries (`:23`) is the answer: the
parent's id is that array, and its own ancestry is that array minus its
last segment. Nothing needs to be guessed.

The graph is re-read on every `getChildren` call today. `getParent` is
called once per level during a reveal, so the reveal path should build
its chain once — from the same read that enumerated the rows — rather
than re-reading `openspec/` per level. That is a cost decision, not a
correctness one, and it should be stated as such in the code so nobody
later "fixes" it into a cache that has to be invalidated.

## Decision: the graph moves to `createTreeView`, and what that reverses

`reveal` lives on the `TreeView` handle, which only `createTreeView`
returns. The graph therefore moves.

What this reverses is narrower than it looks, and the comment at
`extension.ts:200-202` should be corrected rather than deleted. That
comment gives the reason as "no command reads this view's selection",
and that stays true: `revealInChanges` is a context-menu command and
receives its row as an argument. The view moves because it must be
revealed *into*, not because anything reads its selection.

The other half of the original decision — that the graph is read-only,
because every action on a change belongs where the change appears
exactly once — is untouched. Revealing is not acting. No mutating
command gains a graph entry here.

## Decision: route by the row's own `archived` flag

A graph row carries its node, and the node says whether it is archived
(`:33`). Reveal into the Archive tree for an archived change and the
Changes tree otherwise.

Revealing into the wrong tree fails silently — `reveal` on an element
that tree cannot resolve does nothing and reports nothing — which is
worse than not offering the command. Since the graph is read from disk on
refresh, a row can also outlive the change it names; that case reports
what happened rather than throwing.

## Rejected: making the graph show every change

Adding relation-less changes so a reveal always lands would turn the view
into the Changes tree with extra indentation, and would delete the one
thing the graph says that no other view does: that these changes are
related and those are not. The CLI's `--all` already serves anyone who
wants the flat listing.

## Rejected: revealing several rows as a multi-selection

`TreeView.reveal` takes a single element, and a selection spanning
several rows would have to be assembled by revealing each and extending
the selection — which VS Code's API does not offer for trees. Expanding
each and selecting the first, with the count reported, delivers the same
information without pretending to an API that is not there.

## What this does not decide

Whether the Changes tree should show, on a change, that it has relations
at all — a badge saying "in the graph" would make the reveal command's
availability predictable rather than something a reader discovers by
trying it. That is a change to how a change renders in the list, it
affects every row, and it should be argued on its own.
