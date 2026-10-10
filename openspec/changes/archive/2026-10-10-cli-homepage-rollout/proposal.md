# Proposal

## Why

The producer merge gate requires every implementation task complete before merge,
but production verification can only occur after merge and version publication.
The owner approved separate post-merge tracking on 2026-10-10, so release proof
is recorded here rather than claimed prematurely on the implementation change.

## What Changes

Record homepage PRs, deploy commits, producer PR and version release, manifest
commit, live CLI version/npm URL, and Markdown rendering after authorized rollout.
No application code, protocol, registry authentication or deployment mechanism changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is operational verification paperwork; `skip_specs: true` applies.

## Impact

This change's tasks and rollout evidence. Keep it open until observed results
are recorded. Do not bypass CI, publish npm implicitly, or claim success from
an HTTP 200 without confirming the deployed revision and rendered contents.
