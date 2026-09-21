Asked for by the owner on 2026-09-21: rebase a behind branch in the
product itself, for everybody who uses it, as a setting that is on by
default. ADR 0034 records the decision.

## 1. The decision

- [x] 1.1 `docs/adr/0034-a-behind-branch-is-rebased-for-you.md`, listed in
  `docs/adr/README.md`, naming the rule in `HARNESS.md` it is an
  exception to and why that exception is narrow.

## 2. git

- [x] 2.1 `rebaseOnto(onto)` rebases the checked-out branch and, on a
  conflict, names the files and aborts before returning, so the branch is
  exactly as it was.
- [x] 2.2 `pushWithLease(remote, branch, expected)` pushes with
  `--force-with-lease=<branch>:<expected>`.
- [x] 2.3 `restoreTo(commit)` puts the branch back, used only after a
  refused push on a tree that was clean before the rebase.

## 3. The rebase, in core

- [x] 3.1 `rebaseBehindBranches` rebases a directory's branch only where
  every rail holds: named after a change, allowed by its configuration,
  no run recorded, pushed and still on the server, equal to its upstream,
  behind the default branch, clean. Each skip carries the one rail that
  stopped it.
- [x] 3.2 A conflict is aborted and reported with its files; a refused
  push is reported and the branch restored.
- [x] 3.3 `branches.rebaseWhenBehind` in the harness configuration, absent
  meaning `true`, validated, overridable per change key by key, and read
  from the directory the branch is checked out in.
- [x] 3.4 `sweepWorkspace` runs both jobs - remove what has landed, then
  rebase what is behind - and `describeWorkspaceSweep` words what it did,
  so the two hosts cannot drift.
- [x] 3.5 Nothing is asked of the server where there is nothing to act
  on: a workspace with no working directory but its own and no change
  branch checked out, or a repository with no remote. Found while
  writing, not in a test: without it a repository that never had a
  remote would be told on every interval that it could not be fetched.

## 4. Both hosts

- [x] 4.1 The editor's sweep runs `sweepWorkspace`, says what it did in
  its output channel, and raises a warning for a conflict.
- [x] 4.2 The standalone's leftovers endpoint runs the same sweep, and the
  Summary shows what it did under "Done for you". Until now the
  standalone only offered to remove a finished working directory.

## 5. Documentation

- [x] 5.1 `HARNESS.md` documents `branches.rebaseWhenBehind`, its rails
  and its cost, and says beside the rule it is an exception to that it is
  one.
- [x] 5.2 `openspec/README.md` says a branch is no longer rebased by hand,
  except for a conflict.
- [x] 5.3 `README.md` says what the product does with branches.
- [x] 5.4 `LeftoverList`'s header stops saying a finished working
  directory is never swept, which stopped being true with
  `git-says-a-working-directory-is-done`.

## 6. Checks

- [x] 6.1 Tests over real git against a bare remote: a behind branch
  reaches the server rebased, a conflict leaves the branch as it was and
  the tree clean, a refused lease restores it, and each rail keeps a
  branch alone. Nine, in the `core-git-subprocess` project, including the
  whole pass through `sweepWorkspace` with a real pruning fetch and the
  quiet case of a repository with no remote.
- [x] 6.2 The setting: on by default, off where turned off, per-change
  override, and a value or key it does not know refused.
- [x] 6.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, with the `openspec` CLI off `PATH`. The one failure is
  `packages/webui/scripts/build-metro-icons.test.mjs`, which fails on
  Windows for its line endings and fails the same way on untouched
  `main`. Two settings-view tests failed first, as they are built to:
  each keeps a sample for every accepted key, and `branches` had none.
- [x] 6.4 A changeset: core, the extension, the server and the web UI
  change. It is what writes each package's `CHANGELOG.md`.
- [x] 6.5 `openspec validate a-behind-branch-is-rebased-for-you --strict`.
- [x] 6.6 **Human-only.** The first real rebase on this machine: a behind
  change branch is rebased and pushed by the sweep, its pull request's
  checks start again, and the editor's output says so.
  **Deferred:** the sweep runs in the editor, from a build that includes
  this change, so it cannot be seen before this lands. It moves to
  `openspec/deferred.md`.
