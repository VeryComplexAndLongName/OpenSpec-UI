# Proposal

## Why

A green CI job does not establish that each OpenSpec scenario was tested. PR Review currently associates scenarios only with job names; the risk is mistaking that association for test coverage. Extend the shared Core design in ADR 0001 with explicit testcase evidence while keeping its provenance visible.

## What Changes

- Import a bounded JUnit XML report in PR Review in both standalone and VS Code, explicitly declaring the tested git commit.
- Associate requirement/scenario identities with exact JUnit classname/name pairs in committed scenario-tests.json.
- Show passed, failed, error, skipped, missing, ambiguous and stale results in the review and copied summary. Mark the commit identity as user-declared, never inferred from XML or file time.
- Persist normalized local evidence across reopening the review and linked worktrees. Do not commit XML, test stdout or failure bodies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- pr-review: explicit JUnit imports and testcase evidence for reviewed scenarios.

## Impact

Core owns parsing, validation, local persistence and report generation. Hosts only collect XML and the declared commit; the existing showPrReview action gains an optional import payload. Existing agent commands/events, scenario-checks.json and forge refresh remain compatible. Add the saxes XML parser. The first MVP uses a documented committed mapping file; editing test associations in a graphical picker and downloading CI artifacts are deferred.

## Changelog

Affected public deliveries: openspec-ui-vscode and @openspec-ui/server.

- PR Review can import JUnit XML and show named test results for OpenSpec scenarios, including skipped, missing and ambiguous evidence. Commit scenario-tests.json to declare associations; the report's tested commit is explicitly supplied by the importer and remains visible in Copy PR summary.
