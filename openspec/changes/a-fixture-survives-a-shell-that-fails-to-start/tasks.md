The `git-refs` fixture builds its remote without starting a shell, and the
tests whose code under test needs one run apart from the parallel load.

## 1. The fixture

- [x] 1.1 In `packages/core/src/git-refs.test.ts`, `repositoryWithRemote`
  builds the bare remote without `git push`:
  - `objects/info/alternates` names the work repository's objects;
  - `git --git-dir <remote> update-ref refs/heads/<branch>` writes `main`
    and `beta`;
  - `git update-ref refs/remotes/origin/<branch>` writes the same commits
    on the work side.

  Do not add a retry around any git command.

  Done.
  - The work repository is committed first, then the bare remote is made.
  - `alternates` holds the work repository's objects path, with forward
    slashes and a trailing newline, written by `writeFile`.
  - One loop over `main` and `beta` writes each branch on both sides.
  - No retry was added, and the function's comment says why it pushes
    nothing.

  The approach was first probed in a scratch repository:
  - the same commands started no shell under `GIT_TRACE`;
  - `git fsck` on the remote was clean;
  - a `git fetch origin` from the work repository then succeeded and wrote
    `FETCH_HEAD`.
- [x] 1.2 The file's three tests pass, and their assertions are unchanged.

  Done: `npx vitest run src/git-refs.test.ts` passed 3 of 3. Only
  `repositoryWithRemote` changed; the `describe` block is untouched.
  - "reads a directory and a file from a branch that is not checked out"
    took 2623 ms. The failing runs had spent about 18 s before dying in the
    push.
  - "moves lastFetchedAt with a fetch…" took 36743 ms. That time is the
    wrapper's own fetch, which still starts a shell.
- [x] 1.3 With `GIT_TRACE=1`, the fixture's git commands start no `sh.exe`.
  Record the count, and the count for the old fixture's two pushes.

  Done on 2026-09-14. For one run of the file, `GIT_TRACE` was pointed at
  a file, and its `start_command: C:/Tools/Git/usr/bin/sh.exe` lines were
  counted.
  - **This fixture:** 1 shell start. It is `git-upload-pack` from the
    wrapper's `fetch("origin")` in the third test, with no
    `git-receive-pack`.
  - **The old fixture** (the file stashed back to `main`): 7 shell starts.
    6 are `git-receive-pack`, two pushes in each of three tests, and 1 is
    `git-upload-pack`.

  Both runs passed 3 of 3 alone, as the old fixture always did alone.

## 2. Tests that need a shell run apart

- [x] 2.1 Trace every shell start across core's whole suite and name the
  file behind each.

  Done on 2026-09-14: `npx vitest run` in `packages/core` with `GIT_TRACE`
  pointed at a file, and the fixture of 1.1 in place. It passed 1457 of
  1457, and the trace held 3 shell starts, each named by its temporary
  directory:
  - `git-receive-pack` into `openspec-git-remote-*`: `wrapper.push` in
    `git.push.test.ts`;
  - `git-upload-pack` from `openspec-git-refs-*`: `wrapper.fetch` in
    `git-refs.test.ts`;
  - `git-upload-pack` from `openspec-standing-*`: the fetch from a remote
    that does not exist in `change-standing.test.ts`. That test expects the
    fetch to fail.

  All three shells are started by the code under test. Only the first two
  tests need their shell to succeed.
- [x] 2.2 `packages/core/vitest.workspace.ts` names those two files once,
  as `SHELL_STARTING_TESTS`. The `core` project excludes them, and the
  `core-git-subprocess` project includes them. `change-standing.test.ts`
  stays in `core`.

  Done. The block comment above `SHELL_STARTING_TESTS` says:
  - why a single fork of their own was not enough: the two projects ran at
    the same time;
  - what starts the shell;
  - why `change-standing.test.ts` stays in `core`.

  `npx vitest run --project core-git-subprocess` ran `git-refs.test.ts`
  (3 tests, 43810 ms) and `git.push.test.ts` (1 test, 2580 ms), 4 of 4
  passed, and nothing else.
- [x] 2.3 The `test` script in `packages/core/package.json` runs the
  projects one after the other:
  `vitest run --project core && vitest run --project core-git-subprocess`.

  Done. `npm run test -w @openspec-ui/core` prints that command, so the
  second project starts only once the first has exited with success.

  A run at 13:53 on 2026-09-14 passed:
  - `core` started at 13:53:23 and passed 1453 of 1453 in 103 files;
  - `core-git-subprocess` started at 13:55:38, after `core` had exited;
  - in that project, `git-refs.test.ts` passed 3 tests in 11167 ms and
    `git.push.test.ts` 1 test in 2065 ms.

## 3. Verification

- [x] 3.1 This change validates strictly. `check(validate-change)`
- [x] 3.2 Run `npm run verify` unpiped, with everything staged. Record each
  package's test count, and whether the two files of 2.2 passed inside it.

  Done on 2026-09-14, 13:56 to 14:04. The run was unpiped, with everything
  staged, on main `8764124`, and the CPU load was 53% before it started.
  It exited 0: typecheck and lint passed.

  The tests:
  - the root scripts: `test:english` 4, `test:screenshots` 11,
    `test:test-budgets` 10 and `test:changesets` 9, all passed;
  - cli: 161 in 16 files, all passed;
  - core `core` project: 1453 in 103 files, all passed;
  - core `core-git-subprocess` project, started at 14:00:39 after `core`
    had exited: `git-refs.test.ts` 3 tests in 12562 ms and
    `git.push.test.ts` 1 test in 4168 ms, 4 of 4 passed;
  - extension: 375 in 28 files, all passed;
  - server: 100 in 4 files, all passed;
  - webui: 472 in 51 files, all passed.

  It was the first full verify that day to pass with no failure. The branch
  is rebased onto main after this run, which brings in
  `openspec-config-parses-again`'s check. CI runs the rebased branch.

  The attempts before it:

  **First run, 2026-09-14 at 13:28, on main `8764124`, with only the
  fixture of section 1 staged.** It failed. Typecheck and lint passed. The
  tests:
  - the root scripts all passed;
  - cli 161, extension 375, server 100 and webui 472, all passed;
  - core: 1457 in 105 files, with 1456 passed and 1 failed.

  `git-refs.test.ts` passed inside it, 3 of 3. It had failed in each of the
  five full verifies earlier that day. The one failure was `git.push.test.ts`,
  "pushes a branch that has no upstream yet":
  - it ran in the `core-git-subprocess` project;
  - it hit the same MSYS fatal, `add_item ("\??\C:\Tools\Git", "/", ...)
    failed, errno 1`;
  - the shell was started by `wrapper.push`, while the `core` project ran
    beside it.

  That run is why section 2 exists.

  **With section 2 in place,** `npm run test -w @openspec-ui/core` was run
  twice. Neither run reached the second project:
  - At 13:43, the `core` project failed one test in `delegated-item-run.test.ts`,
    "keeps a status record naming the change while the run is under way,
    and removes it after". It expected `["demo"]` and got `[]`. Its
    `vi.waitFor` has vitest's default timeout of 1000 ms, and the record was
    not there within it. The file alone then passed 15 of 15, three times.
  - The second run crashed after `sprint-report.test.ts` with no test
    failed. tinypool's worker teardown threw `Error: kill EPERM` as an
    unhandled `error` event.

  Neither failure is in a file this change touches.

  During both runs one CPU core was taken by a stray process: a PowerShell
  process left from an earlier transcript search by the implementing agent.
  It had been busy since 12:26 with no child process. It was stopped at
  13:52. With it gone, the load was 57%, from other applications, and then
  33%. The core run recorded under 2.3 followed and passed.
- [x] 3.3 No changeset: only tests and test configuration change.

  Done. The change touches `packages/core/src/git-refs.test.ts`,
  `packages/core/vitest.workspace.ts`, the `test` script in
  `packages/core/package.json`, and this change's own files. None of them
  is published behaviour.
