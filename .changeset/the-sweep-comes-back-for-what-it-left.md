---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
---

The sweep comes back for what an earlier pass left behind. Removing a
working directory leaves a shell where a file was locked at that moment,
and git has already forgotten it, so no later pass could see it: one such
shell sat under the worktree root for a day holding 54 MB of downloaded
editor, and went the moment it was asked a second time.

A shell is now this product's own where it is named after a change this
repository knows, active or archived, and holds no `.git` of its own - and
such a shell is cleared whatever is inside it, rather than only when it is
empty. An empty one is still cleared whatever it is named; anything else
is reported and left alone. Links inside are unlinked before the walk, so
a module overlay's junctions cannot carry the removal into the directory
they point at.

The periodic workspace sweep now does this itself, on the worktree root as
this product resolves it, and says what it removed and what is still held;
a shell it could not remove is asked again on the next pass. Until now it
ran only from the standalone's tidy button.
