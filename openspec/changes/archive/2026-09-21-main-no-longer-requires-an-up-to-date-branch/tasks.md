Asked for by the owner on 2026-09-20, after the merge queue turned out to
be unavailable for a repository owned by a user account.

## 1. The rule goes

- [x] 1.1 The `main` ruleset's `required_status_checks` rule has
  `strict_required_status_checks_policy: false`.
- [x] 1.2 Every required check is still required, and the rest of the
  ruleset - deletion, non-fast-forward, the pull request rule - is
  untouched. Read back after the change:

  - `strict_required_status_checks_policy: false`;
  - required: Typecheck, lint, test, and build; OpenSpec change
    validation (merge gate); Extension integration and package;
    Standalone browser and accessibility; Dependency audit; Version pull
    request installs, builds and packages;
  - other rules: deletion, non_fast_forward, pull_request.

## 2. The merge queue work is withdrawn

- [x] 2.1 `.github/workflows/quality.yml` is exactly what it was before
  #640: no `merge_group` trigger, and the job conditions and concurrency
  rule as they were.
- [x] 2.2 `openspec/README.md` loses the paragraph about joining a queue.
- [x] 2.3 `openspec/changes/the-merge-queue-lands-them-in-order/` is
  removed. Its spec deltas were never applied, so no specification
  mentions a queue.

## 3. The runbook says what is true

- [x] 3.1 `openspec/README.md` says that `main` does not require a branch
  to be up to date, that nobody updates a branch for "out-of-date", and
  that a rebase is for a conflict.
- [x] 3.2 It also says what the dropped rule guarded, so the risk is
  known rather than forgotten: two pull requests green apart can be
  broken together.

## 4. Checks

- [x] 4.1 `npm run lint` after `git add`, and `npm run test` at the root.
- [x] 4.2 `openspec validate main-no-longer-requires-an-up-to-date-branch
  --strict`, and `openspec list` no longer names the withdrawn change.
- [x] 4.3 No changeset: nothing under `packages/` changes.
- [x] 4.4 **Human-only.** Done by Claude on 2026-09-20 at the owner's
  request, for the owner to look at in turn. PR #634 was behind `main` by
  three merges, with all six required checks green on an older tip.
  Before the ruleset change GitHub reported it `BEHIND`; immediately
  after, `CLEAN` and mergeable, with no check re-run and none skipped.
