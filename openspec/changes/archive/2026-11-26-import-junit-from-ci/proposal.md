## Why

PR Review currently relies on a person to download a report and type its commit.
That leaves the CI source unverifiable and makes a stale report easy to import.
ADR 0001 puts evidence handling in Core so standalone and VS Code apply the
same checks.

## What Changes

- Import JUnit by Gitea Actions run ID or GitLab job ID from the workspace origin.
- Show the producing run or job and its commit in PR Review and its summary.
- Check the producer's recorded checkout commit against the provider metadata
  before accepting its report. Preserve the manual import option.

## Capabilities

### New

None.

### Modified

- `pr-review`: import revision-qualified test results from Gitea and GitLab.

## Impact

Shared Core forge and evidence handling, standalone and VS Code actions, and
documentation for preparing the two CI output files.

## Changelog

Affected deliveries: VS Code extension, standalone server, and the Workbench
bundled in the npm CLI.

- Import a JUnit report into PR Review by Gitea run ID or GitLab job ID and
  see its source and checked revision next to the scenario results.
