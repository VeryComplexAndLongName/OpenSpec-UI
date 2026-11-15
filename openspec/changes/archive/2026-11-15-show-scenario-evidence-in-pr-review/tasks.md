## 1. Derive scenario evidence

- [x] 1.1 Inventory ADDED and MODIFIED scenarios from committed delta specs and read the optional scenario-checks.json mapping. Exercise missing, duplicate and invalid mappings.
- [x] 1.2 Render the per-scenario associations and check states in PR Review. Exercise matching and different published revisions and an absent result.
- [x] 1.3 Add release notes for the VS Code and standalone deliveries. Document the mapping file with an example.

## 2. Verify

- [x] 2.1 Run scoped Core PR Review and scenario-evidence Vitest, changed-source ESLint, affected type checks and strict OpenSpec validation. Exercise the PR Review report in the standalone browser; the existing VS Code integration covers the same shared report.


## Verification evidence

- Core Vitest passed all 21 cases in scenario-evidence.test.ts, pr-review.test.ts and spec-delta-check.test.ts. The affected Core TypeScript project and changed-source ESLint passed.
- The standalone Playwright test "opens a worktree PR review and copies the displayed summary" showed the unlinked scenario and copied it to the clipboard.
- Changeset and strict OpenSpec validation passed. Full checks run on the pull request.
