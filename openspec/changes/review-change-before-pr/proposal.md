# Review a Change Before Opening or Updating a PR

## Why

The Pipeline brings the actions for one change together under [ADR 0044](../../../docs/adr/0044-a-change-is-acted-on-from-its-card.md). To review an implementation, users still have to compare the branch with its PR target and find the verification records separately.

## What Changes

- Add **Show PR Review** to an active change's Pipeline card in VS Code and standalone. Read the change from its own working directory.
- Show the committed branch diff from the merge base of the PR target and the local head. Use the open PR's target when it can be read. For a branch without a known PR target, show a clearly labelled comparison with the locally known default branch when available.
- Show recorded Harness mechanical-check results and verification runs with their provenance. Distinguish results for the reviewed commit from results for another commit or an unknown revision. Show when evidence is missing.
- Add **Copy PR summary** for a short Markdown report with the comparison and the results the reviewer saw.

## Capabilities

### New Capabilities

- `pr-review` covers branch comparison, verification evidence and Markdown export.

### Modified Capabilities

- None.

## Impact

Core resolves the comparison, reads recorded evidence and formats the summary. Standalone and VS Code expose it through their existing change actions. The new action reads existing data and can be used with a manually implemented change.

## Changelog

### VS Code extension and standalone app

- Open PR Review from a change's Pipeline card to see its committed diff against the PR target and its recorded verification results. Use **Copy PR summary** to paste the comparison and check results into a pull request.
