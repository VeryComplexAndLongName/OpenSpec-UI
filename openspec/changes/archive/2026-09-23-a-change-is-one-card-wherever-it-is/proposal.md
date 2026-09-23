## Why

Asked by the owner on 2026-09-23, looking at the board: why are the
changes of the other working directories not on it? It says "Changes in
this checkout" - but it is one person working in several folders, and
those folders are just other changes.

He is right, and the previous change was wrong to put this out of scope.
The reason given then was that another directory's change cannot be acted
on from here. That is true of a **list** of things to do; it is not true
of a **board**, which answers "where does each change stand", not "what
can I press".

Splitting the board by folder hides its whole subject. One person with
three worktrees has one flow of work, and a board that shows a third of it
is worse than no board.

## What Changes

- The board shows every active change of the repository, wherever it is
  worked: this working directory's and every other one's, **one card per
  change**. A change worked in two places stands once, and the reading
  kept is this checkout's own.
- A card of another working directory says which directory works it and
  where it stands, and offers no action: a change is the pair of a
  directory and a name, and nothing drawn here may reach the change of
  that name in this checkout (ADR 0026).
- Such a card is no longer drawn a second time under "Other working
  directories". That section keeps its directories, their branches and
  their runs.
- The board's heading becomes "Changes" and says a column is where a
  change is now, wherever it is worked. The arrangement by declared order
  keeps its own heading and its own scope: an order is what this
  repository declares here.
- The stages are read for every working directory of the repository and
  merged by name, since a change that lives only in another worktree has
  no stage in this one - and a change with no stage read would pile into
  Proposed and lie.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - what stands on the board.

## Impact

- `packages/core/src/change-stages.ts`.
- `packages/webui/src/components/PipelineView.tsx` and its tests.
- `packages/extension/src/webview/pipeline-panel.ts`,
  `packages/server/src/rest.ts` - one reader each.
- One requirement in `openspec/specs/shared-ui/spec.md`.

## Explicitly out of scope

- **Changes on other people's branches**, worked from other machines and
  never checked out here. That is the next step, and it needs a different
  reading: the change's files out of a ref rather than off a disk. It is
  what makes the board a team's board rather than one person's, and it
  deserves its own change.
- **Acting on another directory's change.** Read here, never acted on
  from here, as it has always been.
