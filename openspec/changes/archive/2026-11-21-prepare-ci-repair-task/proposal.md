# Proposal

## Why

PR Review can identify failed or absent checks, but a reviewer must still assemble their commit, error and source link into an actionable agent request. Following ADR 0001 and its untrusted-content security invariant, Core should prepare a bounded repair brief from forge evidence without executing instructions embedded in a CI error.

## What Changes

- Add an explicit read-only Prepare CI Repair Task action to PR Review in both hosts.
- Fetch bounded GitHub failure annotations and retain forge-reported failure messages from GitLab/Gitea; identify missing expected checks separately from failed runs.
- Show observed errors, source links, exact checked revision and partial/unavailable details, then offer a copied repair task for the user's chosen agent.
- Preserve historical-head and incomplete-evidence qualifications; do not run an agent, rerun CI, change files or publish anything from this action.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pr-review`: prepare a qualified CI repair task from observed failures or expected checks with no result.

## Impact

Core forge readers/PR Review, the existing change-action REST payload, shared dialog and native extension command. Additive fields only; no unified agent command/event changes and no new dependency. Full log archives and automatic fixes are outside this MVP.

## Changelog

Affected deliveries: VS Code extension and standalone server, with shared Core/UI implementation.

- Prepare CI Repair Task in PR Review gathers available failure details and missing expected checks, keeps their checked commit and source links, and provides a brief to copy to an agent. GitHub annotations and forge-reported messages may be partial; preparing a task does not start a run or modify the change.
