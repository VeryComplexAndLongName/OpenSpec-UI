Asked by the owner on 2026-09-22: do everything ourselves, and do not
rely on the repository's settings; the same predictable behaviour on
every forge, whatever the settings.

## 1. The decision

- [x] 1.1 ADR 0036, superseding decision 5 of ADR 0035; ADR 0035's status
  and the ADR index say so.

## 2. Every forge reads checks and merges now

- [x] 2.1 `Forge.mergeWhenChecksPass` removed; `checksOf` and
  `mergeNow(n, method)` required, for GitHub through `gh` (`gh pr checks
  --json`, `gh pr merge --<method> --delete-branch`), GitHub's REST API
  (no GraphQL any more), GitLab and Gitea.
- [x] 2.2 GitLab's wait for a new merge request to become mergeable, and
  its retries on 422, move into `mergeNow`.
- [x] 2.3 `pullRequestGatewayFor` always goes over the forge `origin` is
  on; the `git` stage keeps ADR 0014's refusal where no check ran.

## 3. The archive pass follows its pull request

- [x] 3.1 `followArchivePullRequest`: pending waits; passed or none ran
  merges, squash then merge then rebase; a failed check or a refusal is
  blocked with the reason.
- [x] 3.2 An open `archive-landed-` pull request is followed before
  anything is opened; one just opened is read from the next pass on.
- [x] 3.3 A pass that merged fetches, so `followMain` brings the archive
  to the checkout in the same pass.
- [x] 3.4 `createArchiveFollower`: the standalone server sweeps again every
  five minutes while an archive pull request is open. The editor does the
  same with its own timer, says a merge, and warns once per reason where
  one is blocked.

## 4. Documentation

- [x] 4.1 `HARNESS.md` (the archive section and its table),
  `README.md`, `openspec/README.md`, the `archive.whenLanded` doc comment.

## 5. Checks

- [x] 5.1 Tests: the pass waits, merges on a pass, merges where none ran,
  falls back from squash, is blocked by a failed check and by a refusal,
  says what it opened; the sweep brings main up to an archive it merged;
  the follower re-sweeps while open and stops once merged; `gh`'s checks
  and merge; GitHub's API merge by method with no GraphQL; Gitea's and
  GitLab's merge now.
- [x] 5.2 Live, 2026-09-22, one throwaway repository per forge. Round 1:
  a commit status set to pending, failure, then success. The pass said
  "#1 is waiting for its checks", then "#1 cannot merge yet: check failed:
  live-ci (failure)", then "merged #1 by squash". Round 2: a second change
  with no checks, merged on the pass after it was opened. Both archives
  were on `main` afterwards.
  - Gitea 1.26.4 at 192.168.137.34: the repository was deleted (204).
  - gitlab.com: the project was deleted and removed permanently (404
    afterwards). The failed check read as "pipeline 2870289985 (failed)".
  - github.com, in a new repository with `allow_auto_merge: false`: round
    1 over the API, round 2 through `gh` with no token in the environment.
- [x] 5.3 The throwaway repository
  `VeryComplexAndLongName/openspec-workbench-follow-test-1790062239759`
  is deleted. `gh`'s token has no `delete_repo`, and GitHub answered 403.
  **Human-only:** the owner deletes it. Done by the owner on 2026-09-22;
  GitHub's API then answered 404 for it.
- [ ] 5.4 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0.
- [ ] 5.5 The whole standalone browser suite passes.
- [ ] 5.6 The extension's integration suite passes.
- [x] 5.7 A changeset: core, the server and the extension, minor.
- [x] 5.8 `openspec validate the-product-merges-what-it-archives --strict`:
  valid.
