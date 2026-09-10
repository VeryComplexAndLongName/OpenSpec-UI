Six places where green does not mean what the name says, or where a
failure renders as nothing.

## 1. The changeset lint

- [x] 1.1 `scripts/check-changesets.mjs`: read bare, single-quoted and
  double-quoted names; refuse a frontmatter line that is none of these,
  naming the file and line.
- [x] 1.2 A test file for the script, or a fixture run in `lint:changesets`
  itself, with all three forms and a misspelled bare name that must
  fail.
  - `scripts/check-changesets.test.mjs`, nine tests under `node --test`
    like the two script tests beside it, wired into the root `test`
    script as `test:changesets`. The script now exports
    `readChangesetFrontmatter` and `checkChangesets(root)` so a test can
    run it over a temporary workspace rather than over this repository.

## 2. The chart test

- [x] 2.1 `packages/server/e2e/change-charts.spec.ts`: assert the per-day
  table's four rows carry two, one, zero and one.

## 3. The fixture

- [x] 3.1 `create-dated-workspace.ts`: every git call passes
  `-c commit.gpgsign=false` and `-c core.hooksPath=<empty temp dir>`.
  - Both settings come from `packages/core/src/test-support/
    git-isolation.ts`, exported as `@openspec-ui/core/test-support/
    git-isolation` so the one list serves `core`'s tests and `server`'s
    e2e fixtures. Its own test builds each hostile configuration through
    `GIT_CONFIG_GLOBAL`, confirms the plain call fails under it, and then
    confirms the isolated call does not. `simple-git` callers get the
    settings plus `unsafe.allowUnsafeHooksPath`, without which it refuses
    the call — see 7.2.
- [x] 3.2 Grep the other e2e fixtures and unit-test helpers that commit
  and apply the same.
  - Four other call sites, all in `packages/core`:
    `change-timeline.test.ts` (`initRepo`, `commitAll`, `commitAllAs`),
    `sprint-report.test.ts` (`initRepo`, `commitAllAs`) and
    `git.push.test.ts` (`commitAll`, plus the two bare `simpleGit` calls
    its one test makes), each through `gitIsolationOptions()`.
    `git.test.ts` also calls `commit()` but mocks `simple-git` away, so
    it spawns nothing. No e2e fixture besides `create-dated-workspace.ts`
    runs git.

## 4. The folder-name test

- [x] 4.1 `change-timeline.test.ts`, the folder-name case: commit the
  archive on a different day from the folder's, or without a commit,
  and assert the source is `folder-name`. Coordinate with
  `a-date-is-one-day-in-every-source`, which changes what the day means;
  whichever lands second keeps this assertion true.
  - Done there, and nothing is left to do here: that change landed first
    and split the case in two. The test named for the commit path now
    archives on 2026-01-05 against a folder saying 2026-01-03 and
    asserts `git-commit`; a second test, "falls back to the folder name
    when no commit moved the change", moves the directory without
    committing and asserts `folder-name`. Both read as their names say,
    so duplicating them here would only add a third copy of the same
    fixture.

## 5. The inbox says it failed

- [x] 5.1 `standalone-entry.tsx`: the inbox state carries a failure
  reason; the block renders it where the count would be.
  - The state is core's `HumanOnlyInboxState` (`loaded` with the inbox,
    or `failed` with a reason) and the sentence is core's
    `describeHumanOnlyInboxState`, so the extension host can render the
    same failure the same way when it needs to. The shell keeps the
    block and puts the sentence in the basis line, where the count goes.
- [x] 5.2 A webui test: a failing inbox request renders the reason, not
  nothing.
  - Two, and neither is a `webui` unit test: `standalone-entry.tsx` is
    deliberately not unit-tested — the note at the top of
    `packages/server/e2e/waiting-on-inbox.spec.ts` says so and points at
    the browser suite as where its rendering is asserted. So the
    rendering assertion is a second test in that file, which fulfils
    `/api/human-only-inbox` with a 500 and expects the block to stay,
    carrying the reason, with the workspace summary beside it still
    loaded. The sentence itself has three unit tests in
    `packages/core/src/human-only-inbox.test.ts`.

## 6. A bridge request that gets no reply

- [x] 6.1 `bridge-request.ts`: a timeout, measured and recorded beside
  the constant, rejecting with the operation's name.
  - `BRIDGE_REQUEST_TIMEOUT_MS = 10_000`, sized from the three
    operations the bridge carries, measured 2026-09-10 over this
    repository (247 changes, 59 specs), five runs each after a warm-up:
    `harness/resolve-global` 0.4-0.9 ms warm and 10.4 ms cold,
    `harness/read-change-override` 0.2-0.4 ms, `custom-agents/list`
    0.7-1.0 ms. Three orders of magnitude of headroom, recorded beside
    the constant.
- [x] 6.2 `HarnessSettingsView`: the rejection is shown and the disabled
  controls are re-enabled.
  - The premise was half wrong and is worth stating: the view already
    caught a rejection, showed `Load failed:`/`Save failed:` with the
    reason, and re-enabled in a `finally`. What it never got was a
    rejection — the promise did not settle. 6.1 is therefore the whole
    fix, and what is added here is three tests in
    `HarnessSettingsView.test.tsx` holding that behaviour down for this
    rejection in particular: a save, a load and a change-override read
    that each get no reply show the message and leave their button
    enabled.
- [x] 6.3 A test: a request with no reply rejects after the interval;
  a reply arriving after the rejection is ignored without error.
  - Six in `bridge-request.test.ts`, on fake timers: rejects at the
    interval naming the operation, does not reject one millisecond
    early, ignores a late reply without throwing, clears the timer when
    an answer arrives, clears every timer on `dispose`, and states a
    default interval.

## 7. Verification

- [x] 7.1 `openspec validate --strict --changes`.
  - 9 passed, 0 failed, 2026-09-10.
- [x] 7.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.
  - Exit 0 on 2026-09-10, redirected to a log rather than piped:
    typecheck across the five packages, then `lint:english` /
    `lint:source-text` / `lint:changesets` / `lint:test-budgets` and the
    per-package eslint, then the tests. Test counts: root scripts 23
    (`check-english` 4, `check-test-budgets` 10, `check-changesets` 9,
    the last of those new here), `@openspec-ui/cli` 48 in 4 files,
    `@openspec-ui/core` 922 in 65 files, `openspec-ui-vscode` 320 in 24
    files, `@openspec-ui/server` 80 in 4 files, `@openspec-ui/webui` 361
    in 41 files.
  - It took four runs, and the two red ones are worth recording.
    `simple-git`
    refuses a `-c core.hooksPath=...` outright ("not permitted without
    enabling allowUnsafeHooksPath"), so 3.1's isolation failed 28 tests
    across `change-timeline.test.ts`, `sprint-report.test.ts` and
    `git.push.test.ts` — every test that builds a repository. The helper
    now hands `simple-git` that flag alongside the settings, and says
    why. Then the new `git-isolation.test.ts` failed twice over — on the
    third run, having passed on the second, which is itself the evidence:
    its hooks test timed out at exactly the 30_000 ms budget sized from
    an idle measurement, because a hook spawns `sh` through Git for
    Windows' MSYS layer and that is what slows when 64 sibling files run
    beside it; and its cleanup hook hit `EBUSY: resource busy or locked,
    rmdir`. The budget is now sized like this package's other
    git-spawning files and the cleanup retries; both say so in the file.
- [x] 7.3 Version bump via `npx changeset` for webui and server; the
  script change needs none.
  - `.changeset/a-check-that-passes-checked-something.md`: `webui` minor
    (the inbox failure and the bridge timeout are both visible in the
    shell), `core` minor (a new exported state and describer, and a new
    `test-support/git-isolation` export), `server` patch (its e2e
    fixture and specs only). The lint script is in the root package,
    which no changeset can name.
- [x] 7.4 The browser test in 2.1 run locally before the pull request,
  since CI runs it too and a wrong expected shape fails there.
  - The whole suite, not only that spec:
    `npm run test:browser --workspace @openspec-ui/server`, 12 passed on
    2026-09-10, twice — 3.4 and 2.9 minutes (11 tests before this
    change; 5.2's rendering test is the twelfth). It rewrote no screenshot under `docs/images/`:
    `git status` reports nothing there after the run.
  - The run before it was red for a reason worth recording, since it was
    not an assertion: with two tests in `waiting-on-inbox.spec.ts`
    loading the page against one workspace, the file's `afterAll` hit
    `EBUSY: resource busy or locked, rmdir` on Windows while every
    assertion in both tests had passed. That cleanup now retries, which
    is what `fs.rm`'s `maxRetries` is for.

## 8. Spec delta upkeep

- [x] 8.1 Rebase this change's `openspec-workbench` delta on the current
  text of the requirement it modifies.
  - The requirement is also modified by `a-live-check-names-who-performs-
    it`, which is merged but not yet archived — so `openspec/specs/
    openspec-workbench/spec.md` still carries the older text, and a
    delta written against that would have dropped that change's four
    paragraphs about who an item waits on when whichever of the two
    archived second replaced the requirement. This delta is now that
    change's text verbatim, which already contains the failure-reporting
    paragraph and the "The collecting fails" scenario this change
    implements, so either archive order leaves the requirement whole.
