Asked for by the owner on 2026-10-13, after a working directory on a
detached head stood beside the checkout for a day drawing dashed cards for
work that had landed: "the button can be made".

## 1. The reading

- [x] 1.1 `markFinishedDirectories` in `worktree-survey.ts` takes a
  directory on no branch as a candidate where it has a head, and marks it
  `finishedWith: { reason: "merged" }` where `git.mergeBase(main, head)`
  returns the head, the tree is clean and no run is recorded.
- [x] 1.2 `finishedWith.branch` in `worktree-survey-facts.ts` is optional,
  and its comment says why.
- [x] 1.3 `readBranchRefs` reads the refs where the only candidate is on no
  branch.

## 2. Tests

- [x] 2.1 `worktree-survey.test.ts` covers: a clean detached directory at a
  commit the default branch contains (finished, no branch named); one
  ahead of it; one with an unclean tree; one with a run recorded; and one
  where the default branch is not in the refs. The first fails without 1.1.

## 3. Checks

- [x] 3.1 `finished-directories.ts` is unchanged: the sweep keeps a
  directory on no branch, and its existing test for that still passes.
- [x] 3.2 `npm run typecheck && npm run lint && npm run test`, run
  unpiped. Record each package's count.

  Done 2026-10-14 by CI, run 38507448788 on this branch: "Typecheck, lint,
  test, and build", "Extension integration and package" and "Standalone
  browser and accessibility" succeeded. The first run failed on one test,
  the message ratchet (331 against 330): the reason literal written in
  place counted as one more message said in place, and is now written the
  way the branch case beside it is. Locally, `message-register` and
  `worktree-survey` give 45 of 45, and `tsc` on core is clean.
- [x] 3.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass, and `openspec validate
  a-detached-directory-is-offered-for-removal --strict` passes.

  Done 2026-10-14: all pass locally, and `lint` is part of CI's "Typecheck,
  lint, test, and build".
- [x] 3.4 **Human-only, and the owner's alone.** In the standalone
  application - the one place "Left behind" and its press are drawn; the
  editor's Changes view does not draw them - make a directory on a detached
  head at an older commit of `main` (`git worktree add --detach`) and see
  it under "Left behind" with a press to remove it.

  Human-confirmed 2026-10-14: the owner ran the standalone application from
  this branch and reported that it works. Before that, the survey run from
  the branch against the owner's repository had marked `C:/Temp/qwerty` (a
  detached head at `271bfa56`, clean, contained in `origin/main`) as
  `finishedWith: { reason: "merged" }`.
