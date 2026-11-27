## Why

PR Review can show changes since the last pass, but it cannot say which
individual findings are still open or what established their resolution.
Reviewers have to reconstruct that state from notes and chat when the agent
pushes another commit. ADR 0001 places shared review behavior in Core and
leaves the editor and browser in charge of their respective controls.

## What Changes

- Add a local list of review findings for a change, with an optional file and
  line, and the reviewed revision at which each finding was recorded.
- Record when a finding is fixed, verified or dismissed, the relevant revision,
  and a short note. Allow reopening a finding.
- Show findings in PR Review, including when verification is for an older
  revision, and include them in the copied PR summary.

## Capabilities

### New

None.

### Modified

- `pr-review`: retain and update individual review findings in either host.

## Impact

Core needs a durable local finding record shared by linked worktrees. Both
hosts need explicit controls for adding findings and recording decisions.

## Changelog

Affected deliveries: VS Code extension, standalone server, and the Workbench
bundled in the npm CLI.

- Track review findings with file references, correction commits, and reviewer
  decisions in PR Review. Copy the current list with the PR summary.
