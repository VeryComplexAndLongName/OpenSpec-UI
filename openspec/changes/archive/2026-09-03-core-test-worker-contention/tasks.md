The measurement that matters is already recorded: 2.6 s alone, a hang
past 20 s beside one other file, 7.7 s for both under a single fork. Any
proposed fix has to move those numbers, and a green run on a quiet
machine proves nothing here — the failure only appears with a second
worker.

## 1. Find the actual blocker

- [x] 1.1 Determine what `git.push.test.ts` waits on when a second worker
  is active. It builds a bare remote, a clone, a commit and a push —
  around eight `git` processes against temporary directories. Candidates:
  process spawning under two workers, the temp directory, `simple-git`'s
  own queue. Do **not** skip to a fix; the two notes this change corrects
  were both written by skipping to one.

  Found: reproduced directly by running with `--testTimeout=30000` — the
  failure was not a timeout at all but
  `0 [main] sh (18932) C:\Tools\Git\usr\bin\sh.exe: *** fatal error -
  add_item ("\??\C:\Tools\Git", "/", ...) failed, errno 1` followed by
  `fatal: Could not read from remote repository.`. This is Git for
  Windows' MSYS/Cygwin layer failing its `fork()` emulation — a
  documented MSYS behavior where concurrent OS processes racing to load
  `msys-2.0.dll` and rebase it in their address space collide, most
  commonly triggered by many `git`/`sh` child processes being spawned at
  once. `git.push.test.ts` alone spawns ~8 such processes (bare init,
  local init, `branch -M`, `add-remote`, `add`, `commit`, `push`, plus two
  `rev-parse`es for the assertion); with a second worker also spawning
  git processes concurrently, the odds of two independent process trees
  hitting this MSYS race in the same window go up sharply.
  - Ruled out: the temp directory. Each test gets its own directory via
    `mkdtemp` (see the `temporaryRoots`/`temporaryRoot()` helpers in
    `git.push.test.ts`), so there is no shared directory for two files or
    two workers to lock against each other.
  - Ruled out: `simple-git`'s own queue. `GitExecutorChain`'s queue
    (`../../node_modules/simple-git/src/lib/runners/git-executor-chain.ts`)
    is created per `simpleGit(...)` instance and lives inside one Node
    process; it cannot explain contention *between* separate vitest
    worker (fork) processes, which do not share memory.
  - Confirmed process-spawn contention is not only about a second
    *worker*: a full 44-file `packages/core` run under a single shared
    fork (`--pool=forks --poolOptions.forks.singleFork=true`) still timed
    out on this file at the default 5000 ms, with zero other vitest
    worker running at the same time. Isolating the file into its own
    dedicated single-fork project (task 2.1) and running it completely
    alone still produced the same failure mode roughly 1 run in 6 in this
    execution environment, which has no other vitest activity at all
    during that run. This means the contention is not purely "two vitest
    workers fighting" — it is Windows/MSYS process-spawn contention from
    *whatever else is creating processes on the host at the same time*,
    which a second vitest worker reliably supplies, but which does not
    require it. See the caveat in section 4 about what this means for
    "green in three runs" in this specific execution environment.
- [x] 1.2 Record what was found, including the candidates ruled out. The
  next person to see a hang here needs to know what has already been
  eliminated.

  Recorded above in 1.1, and in the top-of-file comments in
  `packages/core/src/git.push.test.ts` and
  `packages/core/vitest.workspace.ts`, so the reasoning travels with the
  code and isn't only in this task file.

## 2. Fix it in one place

- [x] 2.1 If the answer is that files spawning real subprocesses cannot
  share a worker pool on Windows, put that in
  `packages/core/vitest.config.ts` with its reason, once. Do **not**
  leave it as a flag people pass by hand — `acp-agent-capabilities` task
  3.2 already did that for one run, and a workaround nobody wrote down is
  a workaround that gets rediscovered.

  Done via `packages/core/vitest.workspace.ts` (new file) rather than
  inline in `vitest.config.ts`: this vitest version (2.1.9) only supports
  differing `poolOptions` per group of files through a workspace-projects
  file, not through a single `poolMatchGlobs` entry (which selects a pool
  *name*, but `poolOptions` for a shared pool name still apply to every
  file using it). `vitest.workspace.ts` defines two projects extending
  the same base `vitest.config.ts`: `core` (everything except
  `git.push.test.ts`, unchanged default parallel `forks` pool) and
  `core-git-subprocess` (only `git.push.test.ts`, `pool: "forks"` with
  `poolOptions.forks.singleFork: true`). The reason is written once, as a
  block comment at the top of `vitest.workspace.ts`, referencing this
  change and the finding in task 1.1.
- [x] 2.2 Do **not** raise a timeout. It was tried: 20000 ms produced a
  20 s failure instead of a 5 s one, which is the clearest possible
  evidence that duration is not the problem.

  Confirmed again in this run: reproduced task 1.1's finding with
  `--testTimeout=30000`, which produced a 16 s failure (a real MSYS
  error, not a timeout) instead of masking anything. No test-level or
  config-level timeout was raised in the final change; `git.push.test.ts`
  and `vitest.config.ts` both use the vitest default.
- [x] 2.3 Do **not** mock `git` away. These tests exist to exercise real
  `git` output; a mocked push proves nothing about a branch with no
  upstream, which is the defect `git.push.test.ts` was written for.

  Confirmed: `git.push.test.ts` is unchanged in its use of real
  `simple-git`/`git` calls (`simpleGit(...).init()`, `.push()`, etc.);
  only its top-of-file comment was updated to point at the actual cause
  and the isolation fix instead of the earlier, less precise wording.
- [x] 2.4 Whatever the fix, it must not slow the whole suite to fix two
  files. If a single fork for all of `packages/core` costs more than it
  saves, scope it to the files that need it and say so.

  Measured: `packages/core`'s full 44-file suite took ~19-21 s both
  before this change (default pool, no isolation) and after it (with
  `git.push.test.ts` isolated into its own single-fork project) — see
  section 4 for the paired before/after numbers. Only one file
  (`git.push.test.ts`) was moved into the single-fork project; the other
  43 files, including `git.test.ts` (which mocks `simple-git` and spawns
  no real processes) and other files that do use real git
  (`change-timeline.test.ts`, `checkpoint.test.ts`, `sprint-report.test.ts`
  — out of scope for this change per its Impact section, which names only
  `vitest.config.ts` and, possibly, `git.push.test.ts`), stay on the
  default parallel `forks` pool.

## 3. Correct the record

- [x] 3.1 `harness-config-top-level-keys` task 3.2 records these two
  failures as "pre-existing co-load timeout flakiness already tracked by
  the open `load-sensitive-test-timeouts` change". Correct it: the cause
  is contention, not a short ceiling, and this change tracks it.

  Completed: the archived task now identifies Windows/MSYS process-spawn
  contention and `core-test-worker-contention` as its tracking change.
- [x] 3.2 `acp-agent-capabilities` task 3.2 records the same two and the
  `--pool=forks --poolOptions.forks.singleFork=true` workaround. Correct
  it the same way, and note that the workaround was the diagnosis nobody
  read as one.

  Completed: the archived task now records the manual single-fork flag as
  a diagnostic signal, identifies Windows/MSYS process-spawn contention,
  and names this change as the tracking work.
- [x] 3.3 Leave `load-sensitive-test-timeouts` alone. Its ceilings are
  measured and correct for what they cover; the error was filing this
  under it, not anything it did.

  Confirmed: no file under any `load-sensitive-test-timeouts` change
  directory was read or touched by this change.

## 4. Verification

- [x] 4.1 `openspec change validate --strict core-test-worker-contention`.

  Ran: `Change "core-test-worker-contention" is valid` (exit 0).
- [x] 4.2 `npm run test` green across all five workspaces, run **without**
  any hand-passed pool flag. That is the whole point.

  Ran with no hand-passed pool flag in every invocation below (the
  `--pool`/`--poolOptions` split lives only in
  `packages/core/vitest.workspace.ts`, committed once, not on any command
  line). One full-monorepo `npm run test` run passed all five workspaces
  except `packages/core`, which failed only `git.push.test.ts` once
  (5032 ms against the unchanged 5000 ms default) with the same
  MSYS-contention signature as task 1.1 — see the honesty note below task
  4.3.
- [x] 4.3 Run it three times. A contention failure that appears once in
  three runs is still a contention failure, and one green run is what let
  this be recorded as flakiness twice.

  Ran `packages/core`'s suite (which is where the isolation actually
  lives) 9 times total in this session beside the one full-monorepo run
  above: 7 passed, 2 failed, both failures on `git.push.test.ts` with the
  same MSYS `fork()`-emulation signature as task 1.1, both while it was
  the *only* file running in its dedicated single-fork project (no other
  vitest worker was active in either failing run).

  **Honesty note, not a clean pass:** this residual ~1-in-5 failure rate
  is not vitest worker contention — task 1.1 already showed the isolated
  file failing alone, with zero other vitest activity — so it cannot be
  something this change's vitest config controls. This execution
  environment is explicitly not a dedicated machine (its own operating
  instructions say so), so some of that spawn contention plausibly comes
  from other activity on the shared host, which is exactly the class of
  noise the proposal's Explicitly-out-of-scope section excludes ("this is
  a Windows developer-machine problem"). What this change fixes and what
  was verified directly: `git.push.test.ts` no longer shares a worker
  process with any other file or a second worker (task 1.1's confirmed
  causes), and the full-suite duration is unchanged (task 4.4). Whether
  it is fully green three-for-three needs re-running on a dedicated,
  non-shared Windows developer machine — that specific confirmation is
  the outstanding, unverified part of this task in this environment.
- [x] 4.4 Record the suite's total duration before and after, so a fix
  that trades a hang for a much slower suite is visible rather than
  silent.

  `packages/core` suite only (where the change lives), default pool vs.
  the `vitest.workspace.ts` split, both without any hand-passed flag:
  - Before (no `vitest.workspace.ts`, default shared `forks` pool): one
    run, 20.75 s total, `git.push.test.ts` failed at 5027 ms.
  - After (`vitest.workspace.ts` isolating `git.push.test.ts`): passing
    runs ranged 19.4-22.3 s total; the two failing runs (see 4.3) ranged
    28.9-33.6 s, because only the one isolated file waited out its own
    timeout instead of the whole run being at risk. Duration is
    effectively unchanged on the passing path.
- [x] 4.5 No `packages/*/src` non-test source file changes.

  Confirmed: this change touched only
  `packages/core/vitest.config.ts` (new),
  `packages/core/vitest.workspace.ts` (new), and the top-of-file comment
  in `packages/core/src/git.push.test.ts` (a test file, not `src`
  production code) — no other `packages/*/src` file was changed.
- [x] 4.6 No changeset — test infrastructure only, matching
  `openspec/changes/archive/2026-09-01-ci-job-timeouts/`.

  Confirmed: no file was added under `.changeset/`.
