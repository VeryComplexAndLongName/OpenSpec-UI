import { defineWorkspace } from "vitest/config";

// git.push.test.ts is the one file in this package that spawns real `git`
// subprocesses (init, clone, commit, push — around eight processes against
// temporary directories). Tracked as core-test-worker-contention: on
// Windows, Git for Windows' MSYS/Cygwin layer races when its fork-emulation
// runs concurrently across OS processes — confirmed directly in this repo
// by a run that failed with the MSYS `add_item ... failed, errno 1` error
// while a second worker was spawning git processes at the same time. That
// is process-spawn contention, not a short timeout (raising it to 20000 ms
// only produced a 20 s failure instead of a 5 s one) and not the temp
// directory (each test gets its own via mkdtemp, so there is no shared
// directory lock to contend over) and not simple-git's own queue (that
// queue is per simple-git instance, local to one process, and cannot
// explain contention *between* separate vitest worker processes).
//
// Forcing the whole package onto `--pool=forks --poolOptions.forks.
// singleFork=true` was tried and rejected: a full 44-file run under a
// single fork still failed this file at the 5000 ms default, because the
// contention is not only "two workers fighting" but something that
// accumulates in a long-lived process as more `git` subprocesses get
// spawned over the run — a single shared fork just delays the failure
// instead of removing it, and it would slow every other file in the
// package to fix one. Splitting this one file into its own project with
// its own dedicated single fork keeps it from sharing a worker process's
// accumulated state with 40+ unrelated files, and from competing with a
// second worker's own git spawns, without forcing any other test file in
// packages/core off the default parallel pool.
//
// See also packages/core/src/git.push.test.ts's own comment, and
// openspec/changes/core-test-worker-contention/tasks.md section 1 for the
// full investigation record.
//
// a-fixture-survives-a-shell-that-fails-to-start: a single fork of its own
// was not enough. The two projects run at the same time, so this project's
// shell still starts under the `core` project's whole parallel load. It died
// there on 2026-09-14 (`add_item ... errno 1`). A push, fetch or clone
// against a local path is what starts that shell: Git for Windows runs
// `git-receive-pack` or `git-upload-pack` through its MSYS `sh.exe`.
//
// So the files whose result depends on such a shell starting are listed
// once here, and `npm test` runs this project after `core` has finished,
// never beside it (see the `test` script in ./package.json). Traced over
// the whole package, with `GIT_TRACE`, they are the only tests that start a
// shell whose success they need. `change-standing.test.ts` also starts one,
// for a fetch it expects to fail, so it stays in the parallel project.
// finished-directories.removal.test.ts joins them: it spawns real git for
// init, commit, worktree add and worktree remove against a temporary
// repository, which is the same fork-emulation contention on Windows
// (git-says-a-working-directory-is-done).
const SHELL_STARTING_TESTS = [
  "src/git.push.test.ts",
  "src/git-refs.test.ts",
  "src/finished-directories.removal.test.ts",
  // Real git for init, commit and ls-tree against a temporary repository
  // (a-change-is-archived-with-nothing-open).
  "src/archived-since.test.ts",
];

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "core",
      exclude: ["**/node_modules/**", "dist/**", ...SHELL_STARTING_TESTS],
      // load-variance-not-per-file-cost: bound the pool rather than widen
      // the budgets. Measured 2026-09-06 on this 8-core machine, running
      // this package under a deliberate 8-worker CPU co-load:
      //
      //   default pool   5 runs, 6 test failures across 4 files,
      //                  218-387 s wall, slowest test per file up to 64 s
      //   maxForks 4     3 runs, 0 failures, 134-167 s wall, up to 17 s
      //   maxForks 2     2 runs, 0 failures
      //   no parallelism 2 runs, 0 failures
      //
      // The failures under the default pool were timeouts in a set that
      // changed from run to run, which is what made them read as per-file
      // cost. They are not: the same files pass, faster, when the pool
      // stops oversubscribing a machine that is already busy.
      //
      // Four rather than two because four costs nothing when the machine
      // is idle (29-30 s against 27-30 s for the default, two runs each)
      // while two costs about a third (36-42 s), and four was enough.
      //
      // This does not cover hooks: `hookTimeout` stayed at its default in
      // those runs and hook failures survived every bounded configuration.
      // See `hookTimeout` in ./vitest.config.ts.
      poolOptions: {
        forks: {
          minForks: 1,
          maxForks: 4,
        },
      },
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "core-git-subprocess",
      include: [...SHELL_STARTING_TESTS],
      pool: "forks",
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  },
]);
