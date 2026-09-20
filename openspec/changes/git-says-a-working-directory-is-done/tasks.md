Asked for by the owner on 2026-09-20: look at git, and where it says the
branch is merged, remove the working directory. The change is not touched.

## 1. The algorithm, once per sweep

- [x] 1.1 `git fetch --prune` in the main working directory first. Where
  it fails, nothing is removed and the failure is the reason given for
  every directory: `gone` only appears after a prune, and a stale
  reading that removes something is worse than no reading.
- [x] 1.2 `git worktree list` gives the directories; one
  `git for-each-ref refs/heads` with `%(upstream)` and
  `%(upstream:track)` gives every branch's upstream and whether it is
  gone. No call per directory, and no network after the fetch.

## 2. The algorithm, per directory

In this order, and the first answer wins:

- [x] 2.1 The main working directory is kept, always.
- [x] 2.2 A directory with a run recorded against it is kept: something
  is using it now.
- [x] 2.3 A branch with no upstream is kept: it was never pushed, so
  nothing of it landed.
- [x] 2.4 A branch whose upstream is not gone is kept: the branch is
  still on the server, so its pull request has not merged.
- [x] 2.5 A directory whose tree is not clean is kept: somebody's
  uncommitted work, however old. `git status --porcelain`, run only for
  a directory that has passed everything above, so the cost follows the
  finished ones.
- [x] 2.6 Anything else is done, and is removed.

## 3. Removing one

- [x] 3.1 `git worktree remove --force <path>`.
- [x] 3.2 The shell it leaves on Windows is removed too, with a
  recursive delete. Verified on 2026-09-20 that neither git nor
  `fs.rm(recursive)` follows a junction: the module overlay is unlinked
  and the main checkout's `node_modules` is untouched. A test holds
  that, so a later hand-rolled walker cannot quietly reintroduce the
  hazard.
- [x] 3.3 The local branch is left alone. It costs nothing and it holds
  the commits, which matters where a remote branch was deleted without
  merging - something git cannot tell apart from a merge.
- [x] 3.4 Nothing under `openspec/changes/` is read, moved or written by
  any of this.

## 4. What is said

- [x] 4.1 Every removal is reported with its reason, and every directory
  kept is reported with the one reason that kept it.
- [x] 4.2 The row that offered a press now says what happened. A sweep
  that removed nothing says nothing.

## 5. Checks

- [x] 5.1 A test per branch of the algorithm, over a real temporary
  repository with real worktrees: gone and clean, gone and dirty, no
  upstream, upstream alive, a run recorded, the main directory, and a
  failed fetch.
- [x] 5.2 The junction test: a directory holding a junction is removed,
  and the junction's target still has its file afterwards.
- [x] 5.3 `npm run typecheck && npm run lint && npm run test` at the
  root, after `git add`.
- [x] 5.4 A changeset: core and the extension both change.
- [x] 5.5 `openspec validate git-says-a-working-directory-is-done
  --strict`.
- [ ] 5.6 **Human-only.** The six directories on this machine: after the
  sweep, the ones whose branches are gone are removed, the main one is
  there, and `openspec/changes/` is byte for byte what it was. Left open
  until this lands: the sweep runs in the extension, and running it from
  a branch would remove the very directories this change is written in.
