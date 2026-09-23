## Why

The owner's rule, on 2026-09-23: did it, cleared up after itself
completely, as though it had never been there.

A working directory is removed in two acts. git forgets it, then whatever
git left is deleted. Where the second act meets a file a live process
holds, what is left stays - and **nobody ever looks at it again**, because
every pass walks the working directories git lists, and git has already
forgotten this one.

That is not theory. `relations-and-leftovers-explain-themselves` sat under
the worktree root from 2026-09-22 to 2026-09-23: 54 MB, holding nothing
but a downloaded editor under `packages/extension/.vscode-test`, which the
editor's own test run had been holding open at the moment of the removal.
Asked a second time, a day later, it went without a word of complaint. One
retry was all it ever needed.

Two things kept that retry from happening.

- **The rule was emptiness.** `clearWorktreeShells` cleared a shell that
  held no file at any depth and kept everything else, on the reasoning
  that a directory with a file in it is somebody's. But a removal that
  half-finishes leaves exactly the opposite: the files that could not be
  deleted are the ones still there. The rule excused the only case it was
  written for.
- **Almost nothing called it.** It ran from the standalone's tidy button,
  and only when the workspace still had a working directory other than
  the main one. The periodic sweep both hosts run - the pass that removes,
  rebases, archives and follows main - never called it at all, and the
  extension never called it from anywhere.

## What Changes

- A shell is this product's own where it is **named after a change this
  repository knows**, active or archived, **and holds no `.git` of its
  own**. Such a shell is cleared whatever is inside it. What is in a
  directory says nothing about whose it is; its name and the absence of a
  checkout do.
- An empty shell is still cleared, as before, whatever it is named.
- The periodic workspace sweep does this itself, on the worktree root
  resolved the way this product resolves it (ADR 0027), and says what it
  removed and what is still held. A shell it could not remove is asked
  again on the next pass: what holds a file today lets go tomorrow.
- Links inside a shell are unlinked before the walk, as
  `removeWorkingDirectory` already does. A shell that is not empty can
  hold the module overlay's junctions, and what they point at is the
  primary directory's own packages.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - what the sweep clears of what it left behind.

## Impact

- `packages/core/src/workspace-leftovers.ts` and its tests.
- `packages/core/src/workspace-sweep.ts` and its tests.
- `packages/server/src/rest.ts`, so the tidy button and the sweep judge a
  shell the same way.
- One requirement in `openspec/specs/execution-core/spec.md`.

## Explicitly out of scope

- **A directory under the worktree root that nobody here named.** It is
  reported and left alone, as now. This product created that root
  (ADR 0027), but a name it does not recognise is not its business to
  delete.
- **The local branch a merged change leaves behind.** It is the other
  hand-finished step in the cycle, and it is git state rather than a
  directory; it deserves its own change.
