Asked by the owner on 2026-09-22: GitHub without `gh`, over its API, and
the current version finished before a breaking change.

## 1. GitHub over its API

- [x] 1.1 `createGitHubApiForge`: pull requests by branch, a new pull
  request, an automatic merge through GraphQL, and a merge at once for a
  pull request GitHub calls clean.
- [x] 1.2 `forgeFor`: the API with `GITHUB_TOKEN` or `GH_TOKEN`, `gh`
  otherwise, and a hint where `gh` is missing or signed out.

## 2. The git stage on any forge

- [x] 2.1 `Forge.checksOf` and `Forge.mergeNow` for GitHub, GitLab and
  Gitea, read through `parseCheckStatus`.
- [x] 2.2 `pullRequestGatewayOver` and `pullRequestGatewayFor`; the chain
  runner's `git` stage asks for its gateway.

## 3. Documentation

- [x] 3.1 `HARNESS.md`: the forge table, and what the `git` stage needs.
  `README.md`.

## 4. Checks

- [x] 4.1 Tests, 15 new: GitHub's list, automatic merge, a clean merge, a
  repository that allows no automatic merge, checks from runs and statuses
  together, and a merge that deletes the branch; the choice of way; the
  gateway waiting and refusing; GitLab's and Gitea's checks.
- [x] 4.2 Live on github.com, 2026-09-22, with `gh`'s token handed to the
  process as `GITHUB_TOKEN` and no `gh` in the path.
  - On this repository, read only: 147 pull requests read, and #688's
    checks read as a pass.
  - On a throwaway private repository: the archive pass opened #1. GitHub
    refused automatic merging for the new repository ("Auto merge is not
    allowed for this repository"), and the pass left #1 open and said so,
    as ADR 0035 asks. With `allow_auto_merge` turned on, the merge was
    asked again and #1 merged by squash.
  - The `git` stage's gateway opened #2 and read its checks as "no check
    result was available", so it would not merge.
- [x] 4.3 The throwaway repository `VeryComplexAndLongName/openspec-workbench-forge-test`
  is deleted. `gh`'s token has no `delete_repo`, and GitHub answered 403.
  **Human-only:** the owner deletes it. Done by the owner on 2026-09-22
  through the repository's settings; GitHub's API then answered 404 for it.
- [x] 4.4 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 175, core 1798 and 37,
  extension 492, server 114, webui 651.
- [x] 4.5 The whole standalone browser suite passes: 28 of 28.
- [x] 4.6 The extension's integration suite passes: 18 passing.
- [x] 4.7 A changeset: core, the server and the extension, minor.
- [x] 4.8 `openspec validate github-without-gh --strict`.
