Asked by the owner on 2026-09-21: GitLab and Gitea support, with access to
both.

## 1. The forges

- [x] 1.1 `createGiteaForge` and `createGitLabForge` implement `Forge`
  over REST, with the token from the environment.
- [x] 1.2 `parseForgeRemote`, `detectForge` and `forgeFor` find the forge
  `origin` is on. Another host is probed; `GITEA_URL` or `GITLAB_URL` can
  name one; GitHub is taken where nothing answers.
- [x] 1.3 The archive pass and the standings ask `forgeFor`.
- [x] 1.4 Two Gitea behaviours are handled: the head label after a
  deleted branch, and the 404 on a one-branch repository's pull request
  list.

## 2. Documentation

- [x] 2.1 `HARNESS.md` (which forge, which token, and that the `git` stage
  is still on `gh`) and `README.md`.

## 3. Checks

- [x] 3.1 Tests, 15, against a table-driven fetch:
  - remotes read: https, http with a port and the credentials left out,
    scp-like, ssh;
  - forges detected, with asking and without;
  - Gitea: the list, the label, the 404, a pull request, a merge, a
    refused token;
  - GitLab: the list, a merge request, a merge, waiting for GitLab to
    decide and trying a 422 again, and a refused merge.
- [x] 3.2 Live on Gitea 1.26.4, 2026-09-22, in a throwaway `root`
  repository deleted after each run.
  - `detectForge` read the remote as Gitea.
  - A pull request was listed, opened, listed as open, merged by squash
    and listed as merged.
  - Without a token, the reading said `GITEA_TOKEN is not set`.
  - The archive pass ran end to end with the real `openspec archive`. It
    found the finished change on `origin/main` and opened #1, and #1
    merged by itself. `origin/main` then held the change in the archive,
    with its spec applied.
  - The two Gitea behaviours in 1.4 were found in these runs.
- [x] 3.3 Live on gitlab.com, 2026-09-22, in a throwaway private project
  in the owner's namespace, with a classic token the owner gave for it.
  The first token given was fine-grained without the permissions this
  needs: GitLab answered `insufficient_granular_scope`.
  - First run: the merge request opened, and the merge asked for at once
    was refused with 422 "Branch cannot be merged". GitLab had not yet
    worked out whether it could merge. The forge now reads the merge
    request until GitLab has decided, and tries a 422 again before
    believing it.
  - Second run: the archive pass opened !1, !1 merged by squash, and
    `origin/main` held the change in the archive with its spec applied.
  - gitlab.com schedules a deletion under a renamed path. Each test project
    was then removed permanently: the project answers 404, and the owner's
    namespace holds only its own two projects.
- [x] 3.4 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add` and rebased on `main`, run unpiped, exit code 0: cli 175,
  core 1785 and 37, extension 492, server 114, webui 651. A first run,
  before the rebase and under load, failed `stop-boundary.test.ts` once;
  alone it passed three times of three.
- [x] 3.5 The whole standalone browser suite passes: 28 of 28.
- [x] 3.6 The extension's integration suite passes: 18 passing.
- [x] 3.7 A changeset: core, the server and the extension, minor.
- [x] 3.8 `openspec validate the-forge-is-gitlab-or-gitea-too --strict`.
