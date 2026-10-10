## Why

The owner, on 2026-10-10, about the repository `HppMCP`: its four changes,
each in a worktree of its own, all read as somebody else's, with no button
on their cards. Two causes:

- The rules agents are given (ADR 0043) say where a change's commits go -
  "its planning artifacts, its code, its commits and pushes - in that
  directory" - and never when. An agent made the worktree, wrote the files
  and stopped. Every branch was where `main` was, and every change was
  untracked files on one disk: no other directory, host or person saw it.
  The product's own Create Change did the same, and the `git` stage pushes
  but never commits.
- In the Pipeline's arrangement by step, a card of another working
  directory is drawn with no actions at all, even for the change that
  directory was made for. Only the board, by stage, gave it its actions
  (a-change-is-acted-on-from-its-card).

The goal, in the owner's words: when a change is made, everything needed is
done, so the change can be worked at once as one's own.

## What Changes

- The agent workflow rules say when: commit the planning artifacts on the
  change's branch and push it with an upstream as soon as they are
  written; commit and push after every task ticked; leave nothing
  uncommitted or unpushed at the end of a turn; nothing of a change on
  `main`; a refused push is said, not worked around.
- Create Change, in both hosts, commits the new change on its branch and
  pushes it at once. A refused push leaves the change made and says why
  (`OSW-GIT-203`).
- The `git` stage commits what the stages left before it pushes
  (`OSW-GIT-103` where that commit fails).
- The survey says where a change's own branch is not on the server: never
  pushed, or at another commit. Read from the refs it lists anyway, so no
  git runs in the directory.
- A card of a change's own worktree says so ("not on the server"), and a
  new action, **Commit Change**, commits everything the worktree holds on
  the change's branch and pushes it. On the card and in Show Actions..., in
  both hosts; refused in the main checkout and on the default branch.
- A card of a change's own worktree offers its actions in the arrangement
  by step as on the board.
- Messages in the register's new GIT group (`OSW-GIT-001`..`203`). ADR 0043
  amended.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-core`: the rules say when to commit and push; a new change is
  committed and pushed as it is made; the git stage commits what the
  stages left; Commit Change.
- `shared-ui`: a card of a change's own worktree acts arranged by step too,
  and says where its branch is not on the server.

## Impact

- `packages/core`: `change-commit.ts` (new), `change-in-its-worktree.ts`,
  `agent-workflow-rules.ts`, `harness-chain-runner.ts`, `worktree-survey.ts`
  and its facts, `change-actions.ts`, `message-register.ts`; their tests.
- `packages/webui`: `PipelineView.tsx`, `standalone-entry.tsx`.
- `packages/extension`: the Commit Change command and its manifest entry,
  Create Change's announcement.
- `packages/server`: Commit Change in the change-action route; Create
  Change's answer says whether the change is on the server.
- `docs/messages.md` regenerated; ADR 0043 amended; README and the
  extension's README. A changeset for core, webui, extension, server.
- Existing repositories get the new rules when Write Agent Workflow Rules
  is run again; changes already made are committed with Commit Change.
