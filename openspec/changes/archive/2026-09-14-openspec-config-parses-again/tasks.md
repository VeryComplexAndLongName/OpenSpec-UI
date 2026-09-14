The OpenSpec config parses, and the lint gate says so when it does not.

## 1. The config

- [x] 1.1 In `openspec/config.yaml`, turn the `rules.tasks` item that begins
  "A task that an implementing agent cannot perform" into a `>-` block
  scalar. Do not change its words.

  Done. One line was added, `- >-`, and the item's first line moved beneath
  it at the same indent as the rest of the item. No word changed. With
  `yaml`'s `parseDocument`, the file now has 0 errors; on `main` at
  `3c79199` it had 4.
- [x] 1.2 `openspec instructions tasks --change <any active change>` prints
  that item's text and no "could not parse" warning.

  Done on 2026-09-14: `openspec instructions tasks --change
  a-gh-refusal-names-its-cause` in this worktree exited 0, with no "could
  not parse" line. It printed the item as one line: "- A task that an
  implementing agent cannot perform (live, interactive, or manual
  verification) must be marked as such in the task text, … Which marking
  depends on why: `**Human-only**` where no agent can make the check …".

  Before the fix, archiving that change on `main` printed: "Warning: could
  not parse …\openspec\config.yaml (Implicit keys need to be on a single
  line at line 60, column 7:); ignoring it."

## 2. The check

- [x] 2.1 New `scripts/check-openspec-config.mjs` exports
  `checkOpenSpecConfig(text)`. It returns one problem per parse error,
  naming `openspec/config.yaml` and the line, and one per missing top-level
  key (`schema`, `context`, `rules`, `operations`). The script exits 1 on
  any problem.

  Done. On the fixed file `node scripts/check-openspec-config.mjs` printed
  "OpenSpec config check passed." and exited 0.
- [x] 2.2 New `scripts/check-openspec-config.test.mjs`, run by
  `node --test`, has these tests:
  - a config whose rules parse is accepted;
  - a list item with `: ` inside a plain scalar is refused, naming the line;
  - a missing `rules` key is named;
  - the repository's own `openspec/config.yaml` passes.

  Done: `node --test scripts/check-openspec-config.test.mjs` passed 4 of 4.
- [x] 2.3 The root `package.json` runs the check as `lint:openspec-config`
  inside `lint`, and its test as `test:openspec-config` inside `test`.
  `yaml` is a declared dev dependency.

  Done.
  - `lint` runs `lint:openspec-config` after `lint:test-budgets`.
  - `test` runs `test:openspec-config` after `test:changesets`.
  - `yaml` is declared as `^2.9.0` in `devDependencies`. It was added with
    `npm install --package-lock-only`, so the lockfile changed and the
    shared `node_modules` did not.
  - Before this change, `npm ls yaml` listed `yaml@2.9.0` as extraneous:
    installed, but declared by nothing.
- [x] 2.4 The check fails on `openspec/config.yaml` as it stood on `main`
  before 1.1, naming line 60.

  Done. `checkOpenSpecConfig` over `main`'s file at `3c79199` returned 4
  problems:
  - line 60: "Implicit keys need to be on a single line at line 60, column 7";
  - line 63: "Plain value cannot start with reserved character" (a backtick),
    "at line 63, column 23";
  - line 64: "Implicit keys need to be on a single line at line 64, column 7";
  - line 64: "Implicit map keys need to be followed by map values at line 64,
    column 7".

  Each problem starts with `openspec/config.yaml:<line>:`.

## 3. Verification

- [x] 3.1 This change validates strictly. `check(validate-change)`

  Done: `openspec validate openspec-config-parses-again --strict` reports
  the change valid.
- [x] 3.2 Run `npm run verify` unpiped, with everything staged. Record each
  package's test count.

  Run on 2026-09-14 at 14:00, unpiped, with everything staged, on main
  `3c79199`. Typecheck and lint passed, with "OpenSpec config check
  passed." inside `lint`.

  The tests:
  - the root scripts: `test:english` 11, `test:screenshots` 10,
    `test:test-budgets` 9, `test:changesets` 4 and `test:openspec-config` 4,
    all passed;
  - cli: 161 in 16 files, all passed;
  - core: 1457 in 105 files, with 1456 passed and 1 failed;
  - extension: 375 in 28 files, all passed;
  - server: 100 in 4 files, all passed;
  - webui: 472 in 51 files, all passed.

  The core failure is not this change's. In `git-refs.test.ts`, "reads a
  directory and a file from a branch that is not checked out", Git's own
  `sh.exe` died during the test's `git push`. It is the same MSYS failure
  under load that `a-gh-refusal-names-its-cause` 2.2 recorded. The file
  alone passed in this worktree, 3 of 3. The branch
  is rebased onto main after this run, so this stays open until CI passes
  the whole suite on the rebased branch.

  Closed on CI. On PR #506 at `80ca81e`, rebased onto main `8764124`, run
  34832363891 passed "Typecheck, lint, test, and build", with the new
  check inside `lint` and its test inside `test`. "Standalone browser and
  accessibility", "Extension integration and package", "OpenSpec change
  validation (merge gate)", "Dependency audit" and "Dependency review" also
  passed. The release jobs were skipped, as on every pull request.
- [x] 3.3 No changeset: no published package changes.

  Done. The change touches `openspec/config.yaml`, `scripts/`, and the root
  `package.json` and `package-lock.json`, none of them a published package.
