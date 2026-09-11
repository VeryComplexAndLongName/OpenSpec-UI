One workspace, one change at a time — and ADR 0010 says why: the lease
stands in for filesystem isolation that did not exist. A git worktree is
that isolation, and the three changes before this one built everything
needed to use it.

## 1. The decision

- [x] 1.1 `docs/adr/0022-changes-run-side-by-side.md`: a worktree is the
  isolation ADR 0010 decision 2 named as the precondition for
  concurrency. The lease is not relaxed, weakened or made re-entrant — it
  becomes what it always described, a guard on one working directory.
- [x] 1.2 Record the budget decision as its own: spending is summed on
  the read side across the repository's working directories, never by
  pointing several writers at one file. Rotation rewrites the whole log,
  and two rotations interleaving lose entries.
- [x] 1.3 `docs/adr/README.md` gains the row, and ADR 0010 gains a line
  pointing at it — a reader who arrives at "until mutations have
  independent filesystem isolation" should be told where that went.

## 2. Working directories

- [x] 2.1 `packages/core/src/git.ts`: `worktreeAdd`, `worktreeList` and
  `worktreeRemove` on `GitWrapper`. Explicit arguments, as `push` already
  takes: the command that runs is the command that was decided on.
- [x] 2.2 `worktreeList` parses `git worktree list --porcelain` rather
  than the human format, which is column-aligned and lossy for a path
  with a space in it.
- [x] 2.3 A core module that turns the git facts into product ones: which
  worktree belongs to which change, which of those changes are still
  active, and where a new one for a given change would go. Core, not the
  CLI — the hosts will want the same list.
- [x] 2.4 The default path is a sibling of the repository,
  `<parent>/<repo>.worktrees/<change>`. Nested inside the main working
  tree it would put a second copy of the repository under a directory
  every recursive tool walks.

## 3. Refusing before anything is created

- [x] 3.1 The change must be present in the commit the worktree is cut
  from. A change that exists only as uncommitted files produces a
  directory without the change it was created for — successful and
  useless.
- [x] 3.2 The branch must not exist, and the directory must not exist.
  Neither is altered when refused.
- [x] 3.3 Each refusal says what to do: commit the change, pick another
  name, or remove what is there.

## 4. The commands

- [x] 4.1 `openspec-ui-cli worktree add <change> [--path <dir>] [--base
  <ref>]`, `worktree list`, `worktree remove <change>`.
- [x] 4.2 `add` prints the exact `run` command for the directory it
  created. The path is long and starting the chain is the next thing to
  happen.
- [x] 4.3 `list` shows each directory, its branch, the change it belongs
  to, and marks those whose change is no longer active — a worktree
  outliving its change is the litter this command exists to surface.
- [x] 4.4 `remove` refuses a directory holding uncommitted work, and does
  not offer a force flag. `git worktree remove --force` is right there and
  says plainly what it does.
- [x] 4.5 `run` is unchanged: it is pointed at a worktree with the
  `--cwd` it already has. A `--worktree` flag on `run` would couple
  creating a directory to starting an agent.

## 5. One repository, one budget

- [x] 5.1 The chain's `listAuditEntries` dependency sums every working
  directory of the repository, not only the one the run is in. Without
  it, `budget.maxCostUsd` is a per-directory allowance and three
  worktrees silently permit three times the ceiling.
- [x] 5.2 The aggregation is on the read side. Each directory keeps
  writing its own log — one writer per file, no locking, nothing changed
  about how a run records itself.
- [x] 5.3 A log that cannot be read is skipped, not fatal. A removed
  directory, or one belonging to somebody else, must not stop a run from
  starting, and an absent log already means "no recorded usage".
- [x] 5.4 Wired where the CLI builds the chain runner, so a terminal run
  in a worktree is measured against the repository. The two interactive
  hosts keep today's behaviour, which is correct for them: they open one
  working directory.

## 6. Tests

- [x] 6.1 Core: the porcelain parse, including a path containing a space.
- [x] 6.2 Core: which worktree belongs to which change, and which
  changes are no longer active.
- [x] 6.3 Core: each refusal in section 3, asserting nothing was created.
- [x] 6.4 Core: the summed budget — usage recorded in a sibling directory
  counts, and an unreadable sibling is skipped rather than fatal.
- [x] 6.5 CLI: `add` reports the run command; `list` marks a worktree
  whose change is archived; `remove` refuses a dirty directory.
- [x] 6.6 Core: the lease is per working directory — two managers rooted
  at two directories both acquire, where two at one directory do not.
  This is the isolation claim, and it is the one thing the whole change
  rests on.

## 6b. What the live check sent back

- [x] 6b.1 Summing the logs across working directories was not enough on
  its own. `totalsByChange` is keyed by the change directory's absolute
  path, and that path differs in every worktree, so the ceiling was
  still permitted once per directory — the spec's claim, unmet by the
  code. `totalForChange` gathers the totals whose directory ends in the
  same change name.
- [x] 6b.2 Matched on the last path segment rather than by rewriting the
  key everywhere: `openspec/changes/<name>` is the only shape a change
  directory takes, every entry summed comes from one repository's own
  worktrees, and re-keying `buildUsageReport` would change what every
  usage surface reports.
- [x] 6b.3 Both directions tested: a sibling directory's spending counts,
  and a different change that happens to be recorded does not.

## 7. Verification

- [x] 7.1 This change validates strictly. `check(validate-change)`
  Run 2026-09-11 through `openspec-ui-cli check`.
- [x] 7.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. Run
  2026-09-11, exit 0 — typecheck, lint and test all green. Counts:
  scripts under `node --test` — english 4, test-budgets 10, changesets
  9; `@openspec-ui/cli` 91 in 8 files (84 before this change);
  `@openspec-ui/core` 1039 in 74 files (1018 before);
  `openspec-ui-vscode` 322 in 24; `@openspec-ui/server` 80 in 4;
  `@openspec-ui/webui` 374 in 41.
- [x] 7.3 Whole browser suite, not only the specs this touches. Run
  2026-09-11, exit 0: 14 passed in 3.2m, one worker, every spec.
  Nothing here touches the browser; run because a selective run once
  reported green while a change broke a spec it never mentioned.
- [x] 7.4 A pending changeset exists. `check(changeset-present)`
- [x] 7.5 **Delegated to `claude-cli`**: two changes run at once, for
  real, in two worktrees of one repository. Evidence to record here: the
  two commands, the two lease files with their different roots, and both
  transcripts showing stages interleaved in time rather than one waiting.
  Unit tests can show that two leases are taken; only a real pair of runs
  shows that two chains actually proceed together.

  Run 2026-09-11 in a throwaway repository with two independent changes,
  `alpha` and `beta`, each `autonomous` with no checkpoints. Two working
  directories were created and both chains started as separate
  processes:

      openspec-ui-cli worktree add alpha --cwd <repo>
      openspec-ui-cli worktree add beta  --cwd <repo>
      openspec-ui-cli run alpha --cwd <repo>.worktrees/alpha   # pid 14948
      openspec-ui-cli run beta  --cwd <repo>.worktrees/beta    # pid 25428

  Both leases were read from disk while both were running, 20 seconds in
  — two files, two roots, two holders, two pids, both heartbeating:

      .../par.worktrees/alpha/.openspec-ui/workspace.lease.json
        holderId e93902b9…  hostKind cli  pid 23316
        acquiredAt 09:16:08.754Z  heartbeatAt 09:16:28.807Z
      .../par.worktrees/beta/.openspec-ui/workspace.lease.json
        holderId 41c8a4d7…  hostKind cli  pid 27856
        acquiredAt 09:16:09.001Z  heartbeatAt 09:16:29.060Z

  Acquired 247 ms apart, not one after the other. Both runs exited `0`
  and both changes archived; their audit logs give the overlap exactly:

      alpha  started 09:17:16   completed 09:18:04
      beta   started 09:17:16   completed 09:18:04

  Forty-eight seconds of both chains running at once, in one repository,
  which before this change was not possible at all.
- [x] 7.6 **Delegated to `claude-cli`**: the summed budget, live. A
  ceiling that one worktree's run has already spent against must stop the
  other worktree's run. Evidence: the configured ceiling, both audit
  logs, and the refusal naming the total.

  **This item is why it was worth doing live.** The first attempt found
  that summing the audit logs across working directories did nothing on
  its own: `buildUsageReport`'s `totalsByChange` is keyed by the change
  directory's ABSOLUTE path, which is different in every worktree, so
  the check still found only what its own directory had recorded. The
  spec's claim was not delivered by the code until `totalForChange`
  (`harness-chain-runner.ts`) gathered the totals by the directory's last
  segment — the change's name. Two tests pin it, and the first of them
  fails against the old lookup with "expected 'cannot archive "demo"…' to
  contain 'budget exceeded'".

  Then, live. A change `gamma` with `budget.maxCostUsd: 5`, a working
  directory for it, and a recorded run of `$6.00` in the **main**
  directory's log while the worktree's own log did not exist at all:

      main log lines: 2
      worktree log exists: False

      openspec-ui-cli run gamma --cwd <repo>.worktrees/gamma
      ✗ budget exceeded: recorded cost $6.00 for this change has reached
        the configured ceiling ($5.00) — stopping before the next stage,
        not because a stage failed
      EXIT=1

  Recorded rather than spent: the agent used here reports no cost at all
  (`usage.costUsd` absent on every entry the parallel runs above wrote),
  so a ceiling cannot be reached by real money in this environment. What
  is live is everything else — the real command, the real configuration,
  the real cross-directory read, and a refusal before any stage started.
