## 1. GitHub check diagnostics

- [x] 1.1 Read GitHub head checks, commit statuses and base branch rules with the existing forge credentials. Add tests for partial results, check app identity and missing expected checks.
- [x] 1.2 Integrate the result in Core PR Review and record the published revision alongside any differing local head.
- [x] 1.3 Add refresh and copy in the standalone dialog and native VS Code command. Test the server contract and exercise the standalone browser and extension host.
- [x] 1.4 Add authored release notes for the VS Code extension and standalone app. Verify the notes with the release-note parser.

## 2. Verification

- [x] 2.1 Run strict OpenSpec validation, selected Core, server, shared UI and extension test files, changed-source lint and affected project type checks. Record the selected commands and results.

## Verification evidence

- Strict OpenSpec validation passed. ESLint passed for changed TypeScript paths. Core, Web UI, server (including browser tests), and extension TypeScript projects passed.
- Core Vitest passed 39 checks in github-checks, pr-review, github-api-forge, gh-pr-list and http-forges. The selected server action contract and Web UI dialog suites passed 6 and 4 tests respectively.
- The standalone Playwright test "opens a worktree PR review and copies the displayed summary" and VS Code 1.145.2 Extension Development Host test "opens PR Review and copies its summary" both exercised the refresh and copied report.
- The GitHub CLI adapter read PR #961 live and found 10 results for the published head and six base-branch requirements. The fixture covers missing required results, wrong-source results, incomplete rules and run links.
- `node scripts/check-changesets.mjs` and `node --test scripts/release-notes.test.mjs` passed. The existing pull request gates run the full suites.
- After the first CI run identified the new action label and fallback message, registered both. The targeted control vocabulary, action vocabulary and message-register tests passed.
