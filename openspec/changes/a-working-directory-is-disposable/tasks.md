`C:\Prog` used to hold repositories and now holds seventeen entries, of
which eleven are. One of the rest comes from this tool's default; the
others have no `.git` at all. And a working directory's run history is
gitignored, so removing the directory destroys it — measured, not
assumed.

**Coordination.** This delivers a `ci-cli` delta. Two proposals on
another branch — `a-doctor-says-what-would-stop-a-run` and
`a-hint-says-what-can-run-together` — deliver one too, and would meet
this in `openspec/specs/ci-cli/spec.md` at archive. Proposals do not
collide; implementations do. Do not implement this alongside either of
those.

## 1. Where a working directory goes

- [x] 1.1 `<root>/<repository>/<change>`. The repository segment is what
  lets one root serve every project without two changes of one name
  colliding on a path.
- [x] 1.2 The root is read from an environment variable, then a
  user-level file, then a default. Never from `openspec/config.yaml`:
  that file travels to every checkout, and a person's disk layout is not
  a property of the project.
- [x] 1.3 The default keeps the repository's parent — `<parent>/.worktrees`
  — so somebody who sets nothing gets one hidden directory where they
  used to get one per repository, at a path no longer than today's.
- [x] 1.4 Still outside the repository. `change-worktrees.ts` already
  records why: a second copy inside is what every recursive tool in the
  repository walks into.
- [x] 1.5 Not the system temporary directory, and the reason is written
  down where somebody will propose it again (ADR 0027): it is swept by
  things that cannot know whether the transfer happened, and a sweep
  bypasses the refusal that protects uncommitted work.

## 2. What leaves before it goes

- [x] 2.1 `worktree remove` merges the directory's `audit.jsonl` into
  the repository's own before deleting anything.
- [x] 2.2 Merging needs no rewriting: an entry already carries its `cwd`
  and `changeDir`. De-duplicated by `runId`, so harvesting twice adds
  nothing the second time.
- [x] 2.3 Browser-suite failure artifacts are taken where present. They
  exist only when something failed, which is when somebody wants them.
- [x] 2.4 Writes are NOT changed. Every run keeps writing to its own
  directory — that is what keeps two runs off one file, and the
  alternative would need a lock in the hot path to replace a copy at a
  rare moment.
- [x] 2.5 What is not taken is named at removal: the run journal, whose
  value expires when its runs end, and the checkpoints, whose purpose
  ends when the change archives. A destroyed thing that was announced is
  a decision; one that was not is a discovery.
- [x] 2.6 The lease is not named. It is ephemeral by construction and
  there is nothing to say about it.

## 3. What already exists

- [x] 3.1 Working directories outside the root are reported, with where
  they are.
- [x] 3.2 A command relocates one on request, by `git worktree move`.
  Nothing moves as a side effect of anything else — somebody may have
  scripts pointing at the old path.
- [x] 3.3 Directories this tool did not create are never moved or
  removed. Three entries beside this repository have no `.git`; what is
  in them is not known here, and acting on them would be acting on a
  guess.

## 4. Tests

- [x] 4.1 A working directory is created under the root, under its
  repository's segment.
- [x] 4.2 The environment wins over the user-level file, which wins over
  the default.
- [x] 4.3 The repository's own configuration is not consulted for the
  root — asserted, because the natural place to put a setting is the
  file that would be wrong.
- [x] 4.4 Removal merges a directory's history into the repository's,
  and merging twice leaves one copy of each entry.
- [x] 4.5 Removal of a directory that recorded nothing takes nothing and
  says nothing was taken.
- [x] 4.6 Removal names checkpoints as discarded before deleting.
- [x] 4.7 Removal still refuses a directory holding uncommitted tracked
  work — the refusal this change relies on must not be lost while its
  neighbour is rewritten.
- [x] 4.8 A directory outside the root is reported and not moved.

## 5. Verification

- [x] 5.1 This change validates strictly. `check(validate-change)`
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-12, exit 0. Typecheck and lint clean across all five packages,
  including `lint:english`, `lint:source-text`, `lint:changesets`,
  `lint:screenshots` and `lint:test-budgets`. Tests: cli 124, core 1130,
  vscode 327, server 84, webui 394 — 2059 across 163 files, 0 failed.
- [x] 5.3 A pending changeset exists. `check(changeset-present)`
- [ ] 5.4 **Delegated to `claude-cli`** — *performed, evidence below, but
  NOT ticked: this was run by the agent that wrote the code, which is the
  rubber stamp the marking rule names. A second reader closes it.*
  Create a working directory, run
  a chain in it so it records history, remove it, and read that history
  back from the repository. Then remove one that recorded nothing.
  Evidence: both logs before and after, and what removal printed. The
  unit tests drive this with logs a test wrote; only a real run shows
  that what a chain records is what removal carries out.

  2026-09-12, in a throwaway repository so this one's worktree list was
  never touched. Real git, the real built CLI, real paths. The boundary,
  stated because it matters: the audit entry was written into the
  directory by the script rather than by a chain, since a chain run
  spends an agent. Everything else — creation, the gitignore behaviour,
  the harvest, the removal — is the real path.

  `worktree add` (exit 0) created it under the root, at
  `<root>/<repository>/<change>`.

  With `.openspec-ui/audit.jsonl`, a checkpoint and a run journal inside
  it, `git status` in that directory reported **clean** — which is the
  whole reason removal used to destroy them.

  `worktree remove` (exit 0):

  ```
  Took 1 run record into this repository's own history.
  Discarding the run journal, which describes runs that have ended.
  Discarding 1 checkpoint, which a rollback would have used.
  Removed .../wt-root/<repository>/a-disposable-change.
  ```

  Read back from the repository afterwards, with its original `cwd`
  intact — which is what lets a combined log stay unambiguous:

  ```json
  {"runId":"live-run-1","agent":"claude-cli","outcome":"completed",
   "cwd":"...\\wt-root\\<repository>\\a-disposable-change",
   "timestamp":"2026-09-12T17:40:00.000Z"}
  ```

  A second directory that recorded nothing: removed at exit 0, took
  nothing, and the repository's log stayed at one entry.

  **The run found a defect the unit tests could not.** Removing a
  directory leaves its branch, so the second `worktree add` for one
  change met a branch with no directory and fell through to git's own
  "a branch named X already exists", which says nothing about what to do
  next. Fixing it exposed a worse one: the first `branchExists` answered
  from whether the call threw, and `rev-parse --verify --quiet` exits 1
  silently for an absent ref without the client treating that as an
  error — so it returned `true` for every branch, and the very first
  `add` in a fresh repository was refused. A check that always says yes
  reads exactly like a working check. It now answers from the output.
  Verified after the fix: first add exit 0, remove exit 0, branch still
  present, second add refused with the remedy.
