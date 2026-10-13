# Design

## Context

`createFileRunLogs(workspaceRoot)` writes under the root of the directory a run
runs in. A change worked in its own worktree therefore logs there, not in the
checkout the host was opened on. The read side, `listRunLogs` and `readRunLog`,
takes one root, and every host passes its own. ADR 0026 already forbids acting
on a path a request names; `resolveOwnWorktree` finds a change's worktree from
its name and `git worktree list`.

## Goals / Non-Goals

**Goals:**

- A card's Show Logs lists, and opens, the runs of its change wherever they
  were logged.
- Every card of a change in its own worktree offers Show Logs.

**Non-Goals:**

- No change to where logs are written, to the log format, or to retention.
- No log reading for a worktree that is not a change's own. A directory that
  is not the worktree of the change the card names is not read.
- No archived card gains Show Logs: its worktree is gone and so are its logs.

## Decisions

1. **The host resolves the place; the request names the change.** A new
   function in core, beside `own-worktree-tasks.ts`, returns the change's own
   worktree path where `git worktree list` has one, else the host's root.
   Rejected: sending the worktree's path from the page - a request is data from
   a page, and ADR 0026 forbids writing to, and by the same reasoning reading
   from, a path it names.
2. **Reading one run names its change.** `pipeline/run-log` and
   `/api/run-logs/read` take an optional `changeName` and read where the list
   found the run. Without it they read the host root, as before, so an older
   caller is unchanged. Rejected: searching every worktree for a run id - it
   reads directories the card did not name and costs a listing per worktree.
3. **Fall back to the host root, never fail.** A change with no worktree of its
   own keeps its logs at the host root (a run started there), which is what the
   button read before. The resolver therefore never refuses.
4. **The button follows `own`.** `DirectoryCard` already knows `own` (the
   directory is the worktree of exactly this change) and already offers Run
   Change on that condition. Show Logs is offered on the same condition, and
   the handler is passed down the same way `onStart` is.

## Risks / Trade-offs

- A worktree removed after a run takes its logs with it (ADR 0027: a directory
  is disposable). The card then says no log was kept, which is true; the
  harvest on removal does not copy `.openspec-ui/runs`. Not changed here.
- Two worktrees on one change name cannot exist (the branch is the change
  name), so the resolver has one answer.
