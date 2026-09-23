## Why

`openspec/deferred.md` holds judgements about shipped work that outlived
the changes that raised them. Two of them were answered on 2026-09-22 by
the product itself, in the owner's editor, and the owner asked on
2026-09-23 that they be ticked with what settled them.

- **A behind branch rebased by the sweep** (from
  `a-behind-branch-is-rebased-for-you`). The sweep rebased three branches
  that day and pushed each with a lease, and each pull request's checks
  ran again on the new head.
- **The main checkout following an archive** (from
  `main-follows-what-landed`). The sweep merged its own archive pull
  request and brought `main` up in the same pass, with nobody pulling.

## What Changes

- Both lines in `openspec/deferred.md` are ticked, each naming what
  settled it and where it was seen, in the style the settled line above
  them already uses.
- A ticked judgement SHALL say what settled it. That is how the first
  ticked line was written, and it is what makes the file readable a month
  later; it is written down here rather than left as a habit.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `openspec-workbench` - what a ticked deferred judgement says.

## Impact

- `openspec/deferred.md`.
- One requirement in `openspec/specs/openspec-workbench/spec.md`.

## Explicitly out of scope

- **The three judgements still open.** Each waits on the owner watching
  the product do something: the Change Graph under a run, a run's logs on
  a card, and the Pipeline's own reading after an archive.
