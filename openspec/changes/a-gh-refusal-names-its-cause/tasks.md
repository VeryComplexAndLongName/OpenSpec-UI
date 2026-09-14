The reason a standing gives when gh refuses to list pull requests names
the cause gh gave (found by a-change-says-where-it-stands 10.6).

## 1. The reason

- [x] 1.1 `whyGhFailed` in `packages/core/src/gh-pr-gateway.ts` tests for
  gh's unknown-host wording ("known GitHub host", "none of the git
  remotes") before its signed-out wording. On a match it returns
  `no remote is on a GitHub host gh knows`.

  Done. A missing binary is still named first, and gh's first line is
  still quoted for any other failure.
- [x] 1.2 `gh-pr-list.test.ts` adds a test that feeds gh's refusal as
  10.6 recorded it and expects that reason. The signed-out test still
  passes. The new test fails with 1.1 taken out.

  Done. The file passes, 5 tests. With `gh-pr-gateway.ts` stashed, the new
  test failed: it expected `no remote is on a GitHub host gh knows` and got
  `gh is not signed in`, while the other 4 passed.

## 2. Verification

- [x] 2.1 This change validates strictly. `check(validate-change)`

  Done: `openspec validate a-gh-refusal-names-its-cause --strict` reports
  the change valid.
- [x] 2.2 Run `npm run verify` unpiped, with everything staged. Record
  each package's test count.

  Run on 2026-09-14 at 12:50, unpiped, with everything staged, on main
  `3cd6e50`. Typecheck and lint passed. The tests:
  - cli: 155 in 15 files, all passed;
  - core: 1435 in 103 files, with 1434 passed and 1 failed;
  - extension: 373 in 28 files, all passed;
  - server: 99 in 4 files, all passed;
  - webui: 468 in 51 files, all passed.

  The core failure is not this change's. In `git-refs.test.ts`, "reads a
  directory and a file from a branch that is not checked out", Git's own
  `sh.exe` died during the test's `git push`. It is the MSYS failure under
  load that `a-run-elsewhere-can-be-asked-to-stop` 4.2 recorded. The file
  alone passed in this worktree, 3 of 3. The branch
  is rebased onto main after this run, so this stays open until CI passes
  the whole suite on the rebased branch.

  Closed on CI. On PR #504 at `2d01e1f`, rebased onto main `352b8a6`, run
  34829509761 passed "Typecheck, lint, test, and build" with the whole
  suite in one run. "Standalone browser and accessibility", "Extension
  integration and package", "OpenSpec change validation (merge gate)",
  "Dependency audit" and "Dependency review" also passed. The release jobs
  were skipped, as on every pull request.
- [x] 2.3 A pending changeset exists: `@openspec-ui/core` at patch.
  `check(changeset-present)`

  Done: `.changeset/a-gh-refusal-names-its-cause.md` names
  `@openspec-ui/core` at patch.
- [x] 2.4 In a scratch repository whose only remote is not on GitHub, run
  `openspec-ui-cli ready` from this branch's source. Record the line that
  says why pull requests were not read, and `gh auth status`.

  Done on 2026-09-14.

  The scratch repository:
  - it lives under the system's temp directory;
  - it holds one change, `probe`;
  - its only remote, `origin`, is a bare repository on the local disk, and
    `main` was pushed to it.

  The CLI ran from this branch's source:
  - `npx tsx src/cli.ts ready --cwd <scratch>/repo` from `packages/cli`;
  - `packages/cli/node_modules/@openspec-ui/core` is a junction to this
    branch's `packages/core`;
  - `import.meta.resolve("@openspec-ui/core")` from there gave
    `file:///C:/Prog/.worktrees/OpenSpec-UI/gh-host/packages/core/src/index.ts`.

  What each command said:
  - **`gh auth status`**, exit 0:
    `✓ Logged in to github.com account VeryComplexAndLongName (keyring)`.
  - **`gh pr list --state all --json number`** in the scratch repository,
    exit 1: "none of the git remotes configured for this repository point
    to a known GitHub host. To tell gh about a new GitHub host, please use
    `gh auth login`".
  - **`ready`**, exit 0. It listed `probe` as `where it stands: Ready`,
    then `1 ready, 0 running, 0 blocked.`, then
    `Main read from origin/main. Refs have never been fetched here. Pull
    requests were not read: no remote is on a GitHub host gh knows.`

  Before this change, the same refusal read "gh is not signed in"
  (a-change-says-where-it-stands 10.6).
