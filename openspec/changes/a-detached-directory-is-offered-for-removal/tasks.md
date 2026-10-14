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
- [ ] 3.2 `npm run typecheck && npm run lint && npm run test`, run
  unpiped. Record each package's count.
- [ ] 3.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass, and `openspec validate
  a-detached-directory-is-offered-for-removal --strict` passes.
- [ ] 3.4 **Human-only.** In the owner's editor, make a directory on a
  detached head at an older commit of `main` (`git worktree add --detach`)
  and see it under "Left behind" with a press to remove it.
