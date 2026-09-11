---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

What can start now, and alongside what.

`openspec-ui-cli ready` reports every active change as running, ready or
blocked, each carrying the fact that produced it, and says for each
ready change which others it can be started alongside.

Whether two changes collide is derived, never declared (ADR 0024): from
a declared `blocked_by`, from two deltas naming the same capability —
which archive into one spec file — and from two branches having changed
the same file. A `touches:` list of paths was rejected: it is written
before the work by whoever knows least about it, and once drifted is
worse than absent because it is believed.

`WorkspaceLeaseManager` gains a read-only peek, and `GitWrapper` gains
`changedFilesBetween`.
