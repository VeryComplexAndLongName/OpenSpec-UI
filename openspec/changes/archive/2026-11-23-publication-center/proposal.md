## Why

Registry publication and article publication need one durable operator view. A lost workflow result must not cause a second write or hide an exhausted failure. The owner requires automatic publication, with server article workers and short OIDC registry workers.
ADR 0058 replaces the manual publication decision in ADR 0048.

## What Changes

- Homepage automatically approves eligible publications, records attempts and confirmations, and bounds retries.
- Quality prepares immutable npm and VSIX release artifacts and publishes their SHA-256 contract. It does not publish to registries.
- Publish pulls Homepage jobs automatically after Quality, on a recovery schedule, or on dispatch. Both registry channels use OIDC without stored publish tokens.
- Supersede the manual-only publication decision with ADR 0058.

## Capabilities

### New Capabilities
- `publication-center`: immutable publication contract and automatic OIDC workers.

### Modified Capabilities
- `release-quality`: replace manual registry publication and prepare CLI release artifacts.

## Impact

Workflow scripts, publishing governance and release documentation. Homepage provides the matching authenticated queue API.

## Changelog

No changeset: this changes release infrastructure only. It does not change delivered behavior in openspec-ui-vscode, @openspec-ui/server or @openspec-ui/cli, and must not rebuild a previously released version.
