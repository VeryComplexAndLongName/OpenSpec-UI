## Why
The 2026-11-24 Homepage outage exposed recovery risks in the publication-center design: a latest-only release snapshot can omit intermediate versions, a delayed npm job can move latest backwards, and the producer silently drops release candidates beyond one hundred entries.

## What Changes
Maintain the published release-history.json archive with every manifest update, retain publication candidates without silent eviction (fail explicitly above 1000), and publish older npm versions under a recovery tag without downgrading latest. Preserve platform reconciliation and signed receipts.

## Capabilities
### New
None.
### Modified
- publication-center: preserve recoverable manifests and npm latest during backlog execution.

## Impact
Publication/release tooling and tests only. No command/event or webui/server protocol changes, registry identities or credentials. No real test publications.

## Changelog
No public delivery package behavior changes; this fixes release production and publication orchestration. No package-version changeset is required.
