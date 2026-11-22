# Design

## Context

See ADR 0059. The owner revised the target after GitLab required personal
verification for hosted jobs. Gitea owns all development CI; GitHub retains
public source and Releases; Homepage manages publication; CircleCI Free is
evaluated for npm and an Entra certificate for Marketplace.

## Goals

Preserve all quality gates, release identities and checked immutable files
while eliminating GitHub Actions from the critical release path.

## Non-Goals

Deleting GitHub, changing public repository links, entering payment details,
renaming packages, changing agent protocols or duplicating Publication Center.

## Decisions

1. Gitea owns source reviews, checks and version automation. Keep explicit
   remote names during cutover and preserve user-owned checkout branches.
   Port every existing gate, including independent audit/review, actual
   extension integration, browser/accessibility and isolated package smoke.
   Reject partial check parity or full local testing as a substitute.
2. A controlled executor mirrors tested source/tags and uploads exact assets
   into existing GitHub Releases through REST API. GitHub Actions is not a
   dependency. Preserve historical assets and source identities; never
   force-update conflicting refs or replace an existing version.
3. Reuse Publication Center eligibility, holds, leases, finite retries and
   remote reconciliation. Adapt its final manifests and worker contract
   instead of editing its active worktrees. Keep registry credentials outside
   the public Flask process. Reconcile a lost completion before another write.
4. Evaluate npm on CircleCI Free hosted infrastructure without a payment card.
   Configure exact organization/project/pipeline/context trust. The worker
   consumes checked tarballs from an allowed GitHub release destination and
   verifies signed receipts and source identity without application builds.
   Real token exchange is required; first legitimate publication remains the
   end-to-end proof. Document missing automatic npm provenance. Reject
   silent direct-publish token fallback or an invented test release.
5. Marketplace uses the existing Entra application's certificate on an
   isolated executor. Restrict private-key access, bound its lifetime and
   document rotation. Derive the actual Marketplace profile, grant only
   Contributor and verify that assignment and immutable extension ids.
   Reader can pass vsce verify-pat; it is not proof of update permission.
6. Keep GitHub public README/docs/feedback URLs and Releases. Withdraw the
   earlier one-month deletion plan. Preserve the abandoned GitLab preflight
   evidence and review unused trust cleanup after replacement access works.

## Risks / Trade-offs

- A free-plan claim is not actual account or hosted-runner execution evidence.
- CircleCI currently lacks automatic npm provenance, a material limitation.
- Certificate authentication requires protected storage and timely rotation.
- Reconcile the final Publication Center release-quality/worker deltas before
  apply, including its old GitHub OIDC and manual-publication requirements.

## Migration Plan

Access probes -> recoverable backups -> Gitea import and real check parity ->
mirror/upload and queue integration -> exact artifact verification -> first
legitimate release -> retire obsolete Actions/publishers -> archive and clean.

## Validation

Run only named local tests, changed-path lint and affected TypeScript projects.
Full verification runs in Gitea. Record actual CI URLs, publisher identities,
artifact hashes, duplicate refusal and blocked operations. Proposal validation
is not implementation or release proof.
