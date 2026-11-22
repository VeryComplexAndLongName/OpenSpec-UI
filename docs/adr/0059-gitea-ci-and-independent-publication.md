# 0059: Gitea CI and independent publication

Status: Proposed

Date: 2026-11-22

## Context

GitHub Actions is unavailable due to account billing. GitLab hosted runners require personal verification that the owner does not want to complete with a payment card. The owner revised the migration: Gitea owns all development and quality/build CI, GitHub remains the public mirror and release asset host, Homepage manages publication, CircleCI Free is evaluated for npm, and a controlled executor authenticates to Marketplace through Microsoft Entra. ADR 0001's shared Core and package identities remain unchanged. Integrate the separate Publication Center instead of duplicating it.

## Decision

1. Run all review checks, builds, version automation and artifact preparation in Gitea. Gate merges on actual results with parity to the former GitHub jobs.
2. Mirror tested source/tags and upload exact immutable artifacts and signed receipts to the existing GitHub Releases through REST API. No GitHub Actions execution is needed for this path. Preserve historical source URLs and files.
3. Prove actual CircleCI Free hosted execution without a card and package-specific npm OIDC authorization before selecting that executor. It claims eligible Homepage jobs and publishes exact checked tarballs without rebuilding or running duplicate application CI.
4. Prove certificate authentication for the existing Entra application and its actual Contributor role on `openspec-ui`. Keep its bounded-lifetime private key only on the isolated executor, with a rotation path, outside the public Homepage process. Sign-in and Reader access are not proof of update permission.
5. Homepage owns eligibility, holds, leases, finite retries, durable outcomes and registry reconciliation. Integrate its accepted Publication Center contract; do not create an independent publisher.
6. Keep both GitHub repositories as public mirrors and release hosts without a deletion date. The earlier GitLab public-home and one-month GitHub retirement plan is superseded. Review unused GitLab trust cleanup only after replacement authorization works.

## Rejected Alternatives

- GitHub Actions publication retains the billing dependency.
- GitLab hosted publication retains the unwanted card-verification dependency.
- A self-hosted GitLab runner is not npm's supported Trusted Publishing path.
- Direct-publish npm tokens are being deprecated in January 2027.
- Rebuilding in a publication service would change the checked bytes.
- Registry publication from Flask would add privileged long-lived credentials to the public application.
- Deleting GitHub would remove public URLs and history the revised scope retains.

## Consequences

CircleCI currently lacks npm automatic provenance attestations; document this material limitation if it is selected. Hosted Free runs and a package-specific npm exchange succeeded on 2026-11-22 without a payment card; certificate authentication and the actual Marketplace Contributor role also passed. These are access evidence, not registry-write or production-cutover evidence. npm requires the first legitimate publish before the new trust's validation deadline. Certificate authentication requires private-key protection and rotation. Reconcile the final Publication Center specs before apply rather than retaining conflicting GitHub/manual-publishing rules. Existing Gitea runner labels share a Docker host and are suitable only for trusted internal authors; untrusted public contributions need an isolated ephemeral VM. No agent protocol, public repository destination or shared-Core delivery architecture changes. See the change's publication-preflight.md for run links and remaining deployment gates.
