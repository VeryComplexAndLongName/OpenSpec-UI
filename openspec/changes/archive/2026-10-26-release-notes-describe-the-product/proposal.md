## Why

Codex CLI and ACP became working Harness agents in Core 0.150.0, but
Extension 0.106.3 and Standalone 1.62.3 say only Updated dependencies.
Core is intentionally non-public in the website manifest, so its detailed
notes do not announce the capability to product users. GitHub releases
lead with an automatic PR list, and the manifest drops wrapped summary
lines. This violates the useful product boundary in ADR 0001; ADR 0054
defines release notes at that boundary.

## What Changes

- Explain Codex CLI/ACP capabilities and usage fixes in product changelogs
  and the two existing GitHub releases, preserving versions and history.
- Require a Changelog section in OpenSpec proposals and short, concrete
  changesets naming each affected public delivery, even for Core work.
- Reject empty, dependency-only placeholder, and overlong changeset copy.
- Preserve wrapped changelog summaries in manifests; put authored product
  highlights before GitHub's generated history and validate them before
  a version PR merges or a release tag is created.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- release-quality: concise product notes, complete summary transport, and
  release-note validation before publishing.

## Changelog

Public deliveries: VS Code Extension, Standalone App, CLI.

- **Codex agents: native CLI and ACP.** Run planning, review, implementation
  and verification with a GPT model, reasoning effort and a stage-appropriate
  sandbox. Inspect output, file changes and token usage; ACP requires the
  separately installed `@agentclientprotocol/codex-acp` bridge.
- Product changelogs, website summaries and GitHub highlights now explain
  delivered behavior and retain complete multi-line notes.

## Impact

Release tooling, CI's release/version jobs, OpenSpec instructions and
product documentation. Patch changesets cover the three public deliveries.
No application command/event, agent runtime, product visibility, manifest
schema, Marketplace dispatch policy, or package version is changed by hand.
