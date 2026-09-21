## Why

On 2026-09-21 the owner asked why two finished changes were still in the
Pipeline long after they merged. Investigating it turned up two defects in
the workspace sweep. Neither was the cause: the editor window had not
reloaded the release that archives. But both were found in the owner's own
log and on the server.

- **A removal git gives up on is left half done.** The editor's output
  said, three times: `could not remove the working directory ...: error:
  failed to delete ...: Filename too long`. Each directory held
  `packages/extension/.vscode-test`, a downloaded editor with paths longer
  than git on Windows can delete.
  - git forgot the worktree and deleted part of it, then stopped.
  - The sweep reported the failure and never ran its own removal, which
    handles such paths.
  - What was left was a directory no survey counts as a worktree, so no
    later pass looked at it again. It was cleared by hand twice that day.
- **The archive pass pushes a branch that archives nothing.** git commits
  nothing, without failing, where nothing was staged. A pass whose archive
  step changed no file pushed the default branch under an
  `archive-landed-` name. It happened once, from a dry run with the
  archive step stubbed, and the branch was deleted. A real `openspec
  archive` always moves files, but nothing guarded the case.

## What Changes

- **The sweep finishes a removal git gave up on.**
  - The shell removal runs whether or not `git worktree remove` succeeded.
    It takes long paths, and unlinks a link without following it.
  - Where git gave up, `git worktree prune` then has git forget the
    directory.
  - A removal is reported as failed only if the shell removal fails too,
    and then with git's reason.
- **The archive pass pushes only a commit.** A commit that commits nothing
  is a failure, "archiving changed nothing". Nothing is pushed or opened,
  and what the pass made is removed as on any other failure.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the workspace sweep's removal and archive pass.

## Impact

- `packages/core/src/finished-directories.ts`, `landed-archive.ts`,
  `git.ts` (`worktreePrune`).
- Tests in `finished-directories.test.ts`,
  `finished-directories.removal.test.ts`, `landed-archive.test.ts`.
- A changeset: core, the extension and the server run the sweep.

## Explicitly out of scope

- **Telling a person that the running extension is older than the one
  installed.** This was the actual cause, and it is VS Code's to show. A
  window keeps the code it loaded until it reloads.
