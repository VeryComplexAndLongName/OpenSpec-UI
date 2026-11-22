# Proposal

## Why

GitHub Actions cannot start because the account is locked for billing. The owner revised the migration after GitLab required personal/card verification: Gitea owns all CI, GitHub remains the public mirror and release host, Homepage manages publications, CircleCI Free is evaluated for npm and Entra for Marketplace. ADR 0001's shared Core remains intact; proposed ADR 0059 replaces the execution arrangement without changing public identities.

## What Changes

- Move authoritative repository, pull requests, required checks, Changesets automation and builds to `http://hppiigit:3000/root/OpenSpec-Workbench`.
- Retain the existing public GitHub repositories, source/documentation/feedback URLs and Releases. Mirror tested source/tags and upload artifacts through REST API without GitHub Actions.
- Transfer already built VSIX/npm files with hashes, signed build receipts and exact source identity. Independent workers claim eligible Homepage jobs and publish those bytes without rebuilding or duplicate application CI.
- Verify actual CircleCI Free hosted access without a card and package-specific npm OIDC authorization; verify certificate-authenticated Entra Contributor access for Marketplace before provider cutover.
- Preserve source/history/assets and outstanding PR branches, including PR #1009. Supersede the GitLab public-home and GitHub deletion plan. Retire obsolete Actions/publisher paths only after replacement checks succeed.

## Capabilities

### New Capabilities

- `forge-migration`: development authority, retained public mirror and preservation.

### Modified Capabilities

- `release-quality`: Gitea checks/builds and distinct publisher evidence, reconciled with the final Publication Center before apply.
- `publication-center`: replace the prepared GitHub-only worker arrangement
  with exact CircleCI and Entra identities and signed Gitea receipts.

## Impact

Gitea workflows, mirror/release scripts, publisher identity verification, migration runbook and paired Homepage contract. Integrate the separate `publication-center` work after its queue contract is available; do not edit or duplicate its unfinished worktrees. No agent command/event or public source destination changes.

## Changelog

Affected deliveries: `openspec-ui-vscode`, `@openspec-ui/server`, `@openspec-ui/cli`.

- Existing download and installation destinations are retained while publication results are tracked by Homepage.
- Releases use artifacts checked and built in Gitea, with publication results tracked by Homepage.

Select final Changesets scope from actual delivered behavior. Infrastructure-only portions do not independently require a product version bump. Document CircleCI's npm provenance limitation if that executor is selected.
