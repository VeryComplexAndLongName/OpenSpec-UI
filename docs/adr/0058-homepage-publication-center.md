# ADR 0058: Automatic publication coordinated by Homepage

## Status

Accepted. Supersedes the manual publication decisions in ADR 0048 and the archived changes the-marketplace-publish-is-a-manual-step and one-dispatch-publishes-to-both-channels.

ADR 0059 supersedes this document's GitHub-only execution and identity choices.
The durable Homepage queue, automatic eligibility, finite retries and independent
confirmation remain authoritative. Gitea now prepares checked signed artifacts;
CircleCI publishes npm and the isolated Entra executor publishes Marketplace.

## Context

The owner requests automatic publication with a durable queue, confirmations, status and finite retries in Homepage. Article credentials already live on that server. Registry trusted publishing belongs on GitHub-hosted runners: npm supports this today and Marketplace supports vsce --oidc from 4.0.2.

## Decision

Homepage is the publication coordinator. Eligible articles and checked stable releases are automatically approved. Server timers publish articles. Short main-only Actions pull leased registry work with GitHub-signed identities, use immutable GitHub release assets, reconcile existing remote results, and publish npm and VSIX through native OIDC. Queue attempts and final failures survive deployments.

Keep publish.yml and the npm environment because npm's trusted publisher names them. Marketplace trusts the same workflow with its marketplace environment. Do not fall back to PATs or copy permanent GitHub write tokens to Homepage. Quality prepares artifacts and their public publications.json contract, without registry writes.

## Consequences

Automatic updates no longer require a dispatch or typed per-release confirmation. The operator sees approval, remote confirmation, errors and retry history in Homepage. An uncertain article result requires reconciliation before another write. A failed job receives a finite budget and stays visible after exhaustion. Registry availability still affects publication, while artifact preparation and product validation remain independent of registry writes.

## References

- https://docs.npmjs.com/trusted-publishers/
- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
