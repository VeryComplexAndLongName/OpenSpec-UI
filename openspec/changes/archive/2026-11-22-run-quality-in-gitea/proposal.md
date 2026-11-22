# Run complete product quality gates in Gitea

## Why

GitHub Actions cannot start because of the account billing lock. The existing
Gitea workflow omits extension, browser, package and dependency review checks.
ADR 0060 moves these gates without changing ADR 0001's product architecture.
This is the first independently verifiable part of move-ci-to-gitea.

## What Changes

Run the complete quality inventory on Gitea's internal trusted-author runners.
Keep production credentials and publication outside the quality workflow.
Replace GitHub-only dependency review with a lockfile-aware advisory review.
Make an aggregate gate reject missing, failed or incorrectly skipped checks.
Preserve the existing GitHub jobs until the replacement is proved.

## Capabilities

### New
- gitea-quality: complete internal quality checks and an explicit merge gate.

### Modified
- None. Publication and public product behavior remain outside this bootstrap.

## Changelog

No public delivery behavior changes. This infrastructure-only bootstrap needs
no package changeset; it preserves the CLI/server/extension interfaces.
