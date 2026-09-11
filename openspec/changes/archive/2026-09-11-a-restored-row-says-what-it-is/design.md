# Design

## Decision: the child carries its parent, rather than a recipe for one

`getChangeChildren` already has the real `ChangeTreeItem` in hand when it
builds each artifact. It keeps a reference to it, and `getParent`
returns that object. Nothing is rebuilt, so nothing can be rebuilt
wrongly.

The alternative — carrying the parent's `state` and `artifacts` as extra
fields and reconstructing — was rejected. It is the same bug one field
further away: the next field added to `ChangeTreeItem` is a field the
reconstruction forgets, which is how this one arrived.

## Decision: no parent means no parent

Where an artifact carries no parent reference — the root-level
"OpenSpec Configuration" artifact, which belongs to no change —
`getParent` returns `undefined`, as it does today. An item built outside
`getChangeChildren` gets the same answer. Returning a guess is what this
change removes; returning nothing is what VS Code already handles, since
a root item has no parent either.

## Decision: the test asserts the state, not only the identity

The existing tests assert `getParent(proposal)?.id === change.id`, which
the placeholder satisfied: the id is built from the change name and the
archived flag, both of which it had right. The state was the one field
it got wrong and the one field nothing checked. The new assertions read
`description` and `state`.

## Non-Goals

Changing what a state means, or how it is derived. `deriveChangeState`
is correct and is not touched.

## Risks / Trade-offs

Holding a reference from every artifact row to its change row keeps the
change row alive as long as its children are. A tree of a few hundred
rows makes this immeasurable, and the rows are rebuilt on every refresh
anyway.
