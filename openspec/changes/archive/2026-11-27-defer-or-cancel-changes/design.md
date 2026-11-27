## Context

Archived changes carry accepted requirements. A planning decision needs to
preserve the history of an unaccepted proposal.

## Non-Goals

Deleting branches or worktrees, applying specification deltas, and changing
the state of an already running process are outside this MVP.

## Decisions

- Keep disposition separate from OpenSpec's implementation and archive states.
  Moving a proposal to the OpenSpec archive was rejected because that implies
  an outcome the change did not reach.
- Place reason and history beside the proposed change. A workspace-wide
  registry was rejected because it would require unrelated branches to edit a
  shared file.
- Present dispositions in the Pipeline and require an explicit restore action.
  Hiding the proposal entirely was rejected because a person could lose the
  reason or be unable to return to it.

## Risks / Trade-offs

A deferred or cancelled change may still be an unresolved dependency. It does
not satisfy another change's blocker. An external OpenSpec invocation works
with its own lifecycle rules.

## Verification

Gitea Quality run 8776 passed on implementation head f9dc090da1c4a5eca099c5cbbfbb0bad6f5a6c17. Reviewed optimistic writes, worktree ownership, active Pipeline filtering, preserved blockers, run and archive guards and the disposition history. Chromium deferred the proposal and restored it with its reason. Real Git tests verified that the archive pass skips a cancelled change and refuses an existing archive containing one. Strict validation passed for the new main specification in an isolated archive run.
