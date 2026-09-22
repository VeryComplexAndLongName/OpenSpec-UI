## Why

The product asked only GitHub, through `gh`, about pull requests. The owner
asked on 2026-09-21 for GitLab and Gitea support, and gave access to both:
their gitlab.com account, and a Gitea at `http://192.168.137.34:3000`.

ADR 0035 already reaches the forge through one interface, `Forge`. It
covers the pull requests by branch, opening a new one, and a merge once
checks pass. Only GitHub implemented it.

## What Changes

- **GitLab and Gitea implement `Forge`** over their REST APIs, with
  `fetch`. Nothing is installed. The token is the person's, in their
  environment: `GITLAB_TOKEN` (sent as the `PRIVATE-TOKEN` header) or
  `GITEA_TOKEN` (sent as `Authorization: token`).
  - Gitea: pull requests by branch, paged; a new pull request; a merge
    asked for with `merge_when_checks_succeed`, squash first.
  - GitLab: merge requests by source branch, paged; a new one that removes
    its branch; `auto_merge`.
- **The forge is the one `origin` is on.**
  - github.com is GitHub, and gitlab.com is GitLab.
  - Any other host is asked: Gitea answers `/api/v1/version`, and GitLab
    answers `/api/v4/version`, or refuses it without a token.
  - `GITEA_URL` or `GITLAB_URL` names the web root for an ssh `origin`.
  - A host that answers neither is taken for GitHub, as every workspace
    was before.
- **Both readers ask it:** the archive pass (ADR 0035), and the standings.
  The standings say which change's pull request is open or merged, and
  the directory sweep and the Pipeline read them.
- **Two things Gitea does that its documentation does not say.** Both
  were found live on 2026-09-22 against 1.26.4 and are handled:
  - Once a merge deletes the branch, `head.ref` becomes
    `refs/pull/<n>/head`, and the branch name survives only in
    `head.label`.
  - The pull request list answers 404 while the repository has one branch.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - which forge is asked, and GitLab and Gitea as forges.

## Impact

- New in core, with their test:
  - `forge.ts` (`forgeFor`, `detectForge`);
  - `forge-remote.ts` (`parseForgeRemote`);
  - `http-forges.ts` (`createGiteaForge`, `createGitLabForge`).
- `workspace-sweep.ts` and `change-standing.ts` ask `forgeFor`.
- `HARNESS.md`, `README.md`.
- A changeset: core, the server and the extension.

## Explicitly out of scope

- **The `git` stage's own pull request and merge.** They still go through
  `gh` and wait for GitHub's checks, behind a gateway of their own.
- **Reading GitLab or Gitea CI results.** The forge is asked to merge
  "when checks pass", and the forge decides.
