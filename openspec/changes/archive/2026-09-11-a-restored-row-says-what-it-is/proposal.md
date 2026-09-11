# A restored row says what it is

## Why

Reported on 2026-09-10: after reloading the VS Code window, the change
`a-live-check-names-who-performs-it` showed as `draft` with every one of
its 27 tasks ticked.

`getWorkbenchParent` (`packages/extension/src/tree/changes-tree.ts:278`)
builds a fresh `ChangeTreeItem` for an artifact's parent and passes
`"draft"` as its state, with a comment saying the state is a placeholder
because "it only affects the row's description/icon, neither of which
`reveal`'s internal matching reads". `ChangeTreeItem`'s constructor sets
`this.description = state` and picks the icon from it. The row's
description *is* the state, so the placeholder is not a placeholder; it
is a second, wrong answer to the question the tree exists to show.

The comment is right that `reveal`'s *matching* reads only `.id`. What
it misses is that VS Code renders the object `getParent` returns:
`getTreeItem` hands it straight back, because these items are their own
`TreeItem`. On a window reload VS Code restores the tree's selection and
walks the ancestor chain to do it, so a workspace reloaded with an
artifact selected under a change gets that change's row drawn from the
placeholder. That is exactly the report: one change wrong, the one being
worked on, and only after a reload.

Verified against the reporter's own build: `deriveChangeState` in the
installed 0.46.1 bundle is byte-identical to source, and both the
workspace walk and `openspec list` call this change implemented. Nothing
computes `draft` — it is written in.

## Capabilities

### Modified

- A row rebuilt to answer "what is this element's parent" carries the
  same state as the row the tree drew from the workspace, because it is
  that row.

## Out of scope

Anything else the reload restores. Only the parent chain is wrong here,
and only because a value was written in rather than carried.
