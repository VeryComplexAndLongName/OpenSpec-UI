Found on 2026-09-22 while #710, an archive pull request, and #711 were
open together: an archive branch nothing rebases would never merge in a
repository that merges only what is up to date. Taken on with the owner the
same day.

## 1. The fix

- [x] 1.1 `ArchiveFollowOutcome`:
  - a blocked outcome names its cause: a failed check, checks that could
    not be read, or a refusal;
  - a new outcome, `rebuilt`, with how far behind the branch was.
- [x] 1.2 `makeArchive`: making an archive, shared by opening and
  rebuilding. It clears a stale local branch of the same name first.
- [x] 1.3 On a refusal, where the default branch has moved on past the
  archive's branch and something is due:
  - the archive is made again on the default branch;
  - it is pushed with a lease on the branch's commit.
- [x] 1.4 `describeLandedArchive` says a rebuild.

## 2. Documentation

- [x] 2.1 ADR 0036 decision 3 carries the amendment; `HARNESS.md` says it.

## 3. Checks

- [x] 3.1 Tests, against real git:
  - a refused archive behind the default branch is made again on it, holds
    the default branch's new commit and the archive, and leaves nothing
    behind;
  - a refused archive with the default branch not moved is left as it
    was.

  `landed-archive.test.ts`: 26 of 26.
- [x] 3.2 Live, 2026-09-22, one throwaway repository per forge, each
  deleted afterwards:
  - **Gitea 1.26.4**, with "block merge on an outdated branch":
    - pass 1 opened #1;
    - a commit landed on `main` from another clone;
    - pass 2 said "#1 was refused while 1 commit behind the default
      branch, so the archive was made again on it and pushed";
    - pass 3 merged #1 by squash;
    - `main` then held `landed.txt` and the archive.
  - **gitlab.com**, with a project whose merge method is fast-forward
    only: the same three passes and the same result. The project was
    removed permanently, and answered 404 after.
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 189, core 1822 and 49,
  extension 492, server 114, webui 651.
- [x] 3.4 The whole standalone browser suite: 28 of 28.
- [x] 3.5 A changeset: core, the server and the extension, patch.
- [x] 3.6 `openspec validate an-archive-keeps-up-with-main --strict`:
  valid. The merge gate locally with `--base origin/main`: ok.
