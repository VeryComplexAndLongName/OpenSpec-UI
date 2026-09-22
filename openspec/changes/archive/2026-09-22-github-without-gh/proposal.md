## Why

After #688, GitLab and Gitea were asked over their APIs and GitHub only
through `gh`. The owner asked on 2026-09-22 what happens where `gh` is not
installed, and whether GitHub could be asked over its API too. They want
the current version finished before a breaking change.

Without `gh`, a GitHub workspace lost several things:
- the standings, so the Pipeline could not say which pull request is open
  or merged;
- the archive pass;
- the directory sweep's reading of merged pull requests;
- the `git` stage.

It said only "gh is not installed". The `git` stage was also the last
place that knew only GitHub: its pull request, checks and merge went
through `gh` whatever `origin` was.

## What Changes

- **GitHub over its API.** `createGitHubApiForge` implements `Forge`:
  - pull requests by branch over REST;
  - a new pull request;
  - an automatic merge asked through GraphQL
    (`enablePullRequestAutoMerge`), squash first. A pull request GitHub
    calls "clean", with nothing to wait for, is merged at once.
- **The token decides the way.** `GITHUB_TOKEN`, or `GH_TOKEN` (which `gh`
  reads too), in the environment means the API. Without one, the product
  goes through `gh` as before. Where `gh` is missing or signed out, the
  reading says so and adds "and GITHUB_TOKEN is not set".
- **Every forge can serve the `git` stage.** `Forge` gains `checksOf`
  (read through the same `parseCheckStatus`, so ADR 0014's refusal of
  anything but a pass holds everywhere) and `mergeNow`:
  - GitHub: check runs and commit statuses;
  - GitLab: the merge request's head pipeline;
  - Gitea: the commit's combined status.
- **`pullRequestGatewayFor`** gives the `git` stage a gateway over the
  forge `origin` is on, and falls back on the `gh` gateway where that forge
  cannot read checks.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - GitHub without `gh`, and the `git` stage on any forge.

## Impact

- `packages/core/src/http-forges.ts` (`createGitHubApiForge`, and
  `checksOf`/`mergeNow` for GitLab and Gitea).
- `gh-pr-gateway.ts` (`Forge` extended, `pullRequestGatewayOver`, check
  parsing exported).
- `forge.ts` (the choice of way, `pullRequestGatewayFor`).
- `harness-chain-runner.ts` (the `git` stage asks for its gateway).
- New `packages/core/src/github-api-forge.test.ts`.
- `HARNESS.md`, `README.md`.
- A changeset: core, the server and the extension.

## Explicitly out of scope

- **GitHub Enterprise Server.** A host that answers neither Gitea's nor
  GitLab's version endpoint is taken for GitHub through `gh`, which knows
  its own hosts.
- **The allowlist's wording.** The `git` stage still checks its
  push, create and merge against the allowlist in the `gh` invocations'
  terms, which name the remote and the branches. That is what the
  allowlist matches, whatever forge then does the work.
