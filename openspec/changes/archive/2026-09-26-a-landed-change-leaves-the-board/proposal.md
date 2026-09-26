## Why

Reported by the owner on 2026-09-26: "finished changes hang, though they
were merged into main long ago".

They hung from other working directories. The board reads every working
directory of the repository, and a change's stage comes from the
directory it is worked in. A worktree branched before a change was
archived still holds the change as it was, so the board drew it In
progress - here two changes from a worktree of mine, branched 57 minutes
before the sweep archived them. The board already knew better: the
standings say which changes the default branch carries archived, and a
foreign card even said "archived on main". The column did not listen.

## What Changes

- `settleOnDefaultBranch` in core: a stage reading of a change the default
  branch carries archived becomes Archived, with no "since".
- The board applies it to the stages it reads, so a checkout that has not
  caught up stands such a change in Archived.
- A copy of such a change in another working directory draws no card;
  the archive reading's own card stands for it in Archived where it is
  recent.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - what the default branch archived is Archived on the board.

## Impact

- `packages/core/src/change-stage-facts.ts`, with its test.
- `packages/webui/src/components/PipelineView.tsx`, with its test.
- One requirement in `openspec/specs/shared-ui/spec.md`.

## Explicitly out of scope

- **Removing a stale worktree.** It belongs to whoever made it; the board
  only stops drawing what landed.
- **The arrangement by declared order.** It folds what landed already.
