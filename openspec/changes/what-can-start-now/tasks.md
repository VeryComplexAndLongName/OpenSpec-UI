Two halves exist and are not joined: what each change declares about the
others, and which working directory is busy. Neither answers the
question a person has — which of these can I start now, and alongside
what.

## 1. The decision

- [x] 1.1 `docs/adr/0024-parallel-readiness-is-derived.md`: collision is
  derived from what already exists, never from a declared list of paths.
  A `touches:` list is written before the work by whoever knows least
  about it, drifts within a week, and once drifted is worse than absent
  because it is believed.
- [x] 1.2 Record the three sources and what each costs: a declared
  blocker (free, exact), a shared capability (free, available before any
  work, coarse), and an overlapping branch diff (cheap, precise,
  available only once work has begun).
- [x] 1.3 Record the evidence rather than the argument: in this series
  `a-change-runs-from-the-terminal` and `changes-run-side-by-side` both
  delivered a delta to `openspec/specs/ci-cli/spec.md`, ran one after
  the other, and nobody noticed.
- [x] 1.4 `docs/adr/README.md` gains the row.

## 2. Reading the state

- [x] 2.1 A core module that returns, per active change, a state of
  `running` / `ready` / `blocked` with the fact that produced it. The
  shape follows `ChainStartRefusal`: a reason a reader can act on names
  what governs it.
- [x] 2.2 `blocked` comes from `findUnmetBlockers` — already written,
  already resolving the moment the named change is archived.
- [x] 2.3 `running` comes from the cross-host lease of each working
  directory, read rather than inferred. A held lease names its host,
  hostname and pid, which is what the state should carry.
- [x] 2.3b `WorkspaceLeaseManager` gains a read-only peek. Everything
  that touches the lease today acquires it, and a reporter has to look
  without taking.
- [x] 2.4 A stale lease is not a running change. The staleness window
  already exists; this must use it rather than treat any lease file as
  proof.

## 3. What two changes would collide over

- [x] 3.1 Shared capability: the set of `specs/<capability>/` directories
  a change's delta carries. Two changes sharing one write to the same
  `openspec/specs/<capability>/spec.md` at archive.
- [x] 3.2 Overlapping branch contents: `git diff --name-only
  <base>...<branch>` for a change that has a working directory. Bounded
  by the number of worktrees, not by the number of changes.
- [x] 3.3 A declared blocker between two changes is a collision of its
  own kind and is reported as such, not folded into the other two.
- [x] 3.4 Reported per pair, never as one group. Three changes where A
  and B collide and C collides with neither has no single correct
  grouping, and presenting one hides that a choice existed.

## 4. Needing somewhere to run

- [x] 4.1 A change with no working directory is not startable in
  parallel, whatever its relations allow: one directory permits one
  mutating run.
- [x] 4.2 The report says what would change that, naming the command.
  The remedy is one line and naming it is most of the help.

## 5. The command

- [x] 5.1 `openspec-ui-cli ready`: every active change with its state,
  and under the ready ones what each can start alongside.
- [x] 5.2 `--format json` for a machine, the same shape the core module
  returns.
- [x] 5.3 `change-graph` is left alone. It renders declared relations,
  which is a different question, and one command answering two
  questions answers both badly.

## 6. Tests

- [x] 6.1 Core: each state, and that each carries its reason.
- [x] 6.2 Core: a stale lease reads as not running.
- [x] 6.3 Core: two changes sharing a capability collide; two that do
  not, do not.
- [x] 6.4 Core: two branches touching one file collide, naming the file.
- [x] 6.5 Core: the pairwise answer on a three-change chain where A and
  B collide and C collides with neither — the case a single group would
  get wrong.
- [x] 6.6 Core: a change with no working directory is reported as not
  startable alongside anything.
- [x] 6.7 CLI: the text output groups by state, and the JSON output is
  the module's own shape.
- [x] 6.8 A regression test built from the real pair: two changes whose
  deltas both name `ci-cli` are reported as colliding over it. This is
  the case that actually happened and went unnoticed.

## 7. Verification

- [x] 7.1 This change validates strictly. `check(validate-change)`
- [x] 7.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. Run
  2026-09-11, exit 0 — typecheck, lint and test all green. Counts:
  `@openspec-ui/cli` 97 in 9 files (91 before this change);
  `@openspec-ui/core` 1052 in 76 files (1039 before);
  `openspec-ui-vscode` 322 in 24; `@openspec-ui/server` 80 in 4;
  `@openspec-ui/webui` 378 in 41.
- [x] 7.3 Whole browser suite, not only the specs this touches. Run
  2026-09-11, exit 0: 14 passed, every spec. Nothing here touches the
  browser; run because a selective run once reported green while a
  change broke a spec it never mentioned.
- [x] 7.4 A pending changeset exists. `check(changeset-present)`
- [x] 7.5 **Delegated to `claude-cli`**: run it against a real
  repository with two worktrees live, one of them mid-run, and record
  what it printed. Evidence: the command, the output, and the two lease
  files it read. Unit tests drive the reader with fixtures; only a real
  repository shows whether the states it reports match what is actually
  happening.

  Run 2026-09-11 against a throwaway repository with three changes:
  `alpha` and `beta` both delivering a delta for `ci-cli`, `solo`
  delivering one for `shared-ui` and declaring `blocked_by: alpha`.

  **Before any working directories existed** — the collision is knowable
  with nothing started, which is the whole point of the capability
  source:

      Ready
        alpha
            no working directory of its own — openspec-ui-cli worktree add alpha
            not with beta — both deliver a delta for "ci-cli", which
            archives into one spec file
        beta
            no working directory of its own — openspec-ui-cli worktree add beta
            not with alpha — both deliver a delta for "ci-cli", which
            archives into one spec file

      Blocked
        solo
            waiting on alpha

      2 ready, 0 running, 1 blocked.

  **With two working directories and `alpha` genuinely mid-run**, the
  query was made from a third terminal 18 seconds in:

      Running
        alpha
            in .../rdy.worktrees/alpha (pid 11780, last active 3s ago)

      Ready
        beta
            nothing else can start alongside it

      Blocked
        solo
            waiting on alpha

      1 ready, 1 running, 1 blocked.

  The run finished at exit 0. Three things worth keeping from it: the
  `running` state came from a real lease and named the real pid, not the
  pid of the process that started it; `beta` correctly reports that
  nothing can join it, because the only other ready change is the one it
  collides with; and `solo` stayed blocked throughout, since `alpha` was
  still an active change.
