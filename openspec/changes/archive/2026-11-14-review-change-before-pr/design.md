# Design

## Context

The action follows [ADR 0044](../../../docs/adr/0044-a-change-is-acted-on-from-its-card.md) and the shared Core boundary in [ADR 0001](../../../docs/adr/0001-shared-core-two-delivery-targets.md). The existing artifact diff serves a different comparison. [ADR 0056](../../../docs/adr/0056-pr-review-compares-a-pinned-revision.md) records the additive PR Review contract.

## Goals

- Review the committed worktree branch using the merge base with its PR target.
- Report retained verification evidence with its actual revision and outcome.
- Let either host copy exactly the summary prepared for the displayed comparison.

## Non-Goals

- CI provider status, published PR comments, a merge gate, and running tests from the report.
- Scope inference from prose, scenario-to-test mapping, and hosted storage.

## Decisions

1. Use the repository's existing forge readers for open PR targets. A known target without a local comparison point returns an unavailable comparison. Unavailable or ambiguous PR discovery is shown explicitly alongside any default-branch preview. Comparing against a hard-coded `main` would misstate release-branch PRs.
2. Compare Git commit IDs with a merge base in the change's worktree. Exclude uncommitted edits, disclose them, and label a local head that differs from the open PR's head. The artifact editor's working-tree diff misses committed application code.
3. Read the latest retained mechanical-check record and verify-agent outcome independently. Stamp mechanical checks only when the worktree is clean and its HEAD and worktree remain unchanged across the check commands. Older entries remain usable as historical evidence with unknown revision. Task checkboxes and agent exit codes cannot establish mechanical-check results.
4. Add a typed report to the standalone action response. The extension reads the same report directly from Core and uses its own clipboard. The run command and event protocols are unaffected. Generating the summary independently in each host would make it easy to lose revision qualifications.

## Risks / Trade-offs

- Forge reads may be unavailable or local refs stale. Label the comparison source and show missing history explicitly. This action performs no fetch.
- Some checks leave working-tree changes and older audit records lack provenance. Affected records show an unknown revision.
- Large diffs are bounded. The report identifies a truncated patch and limits the exported file list.

## Verification evidence

The server's `change-actions-rest.test.ts` and standalone browser test
`opens a worktree PR review and copies the displayed summary` passed. The
browser exercised the real server, the PR review response and the clipboard.
The VS Code Extension Development Host smoke also passed. See
[tasks.md](tasks.md#verification-evidence) for commands and coverage.

The comparison still depends on locally available history. Audit records
without a checked commit continue to show their revision as unknown.
