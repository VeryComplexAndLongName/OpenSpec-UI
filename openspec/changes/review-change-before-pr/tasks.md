# Tasks

## 1. Comparison and evidence

- [x] 1.1 Extend `packages/core/src/gh-pr-gateway.ts` to expose the open PR target and published head for the reviewed branch. Verify the GitHub CLI mapping.
- [x] 1.2 Extend `packages/core/src/http-forges.ts` to provide the equivalent GitHub API, GitLab and Gitea metadata. Verify the provider mappings.
- [x] 1.3 Add optional `checkedCommit` provenance to `AuditEntry` in `packages/core/src/security.ts`. Verify historical records still deserialize.
- [x] 1.4 Record `checkedCommit` at the mechanical-check boundary in `packages/core/src/harness-chain-runner.ts`. Verify checkout identity before and after the checks and before bookkeeping writes.
- [x] 1.5 Implement `readPrReview` in `packages/core/src/pr-review.ts` with pinned merge-base comparison, recorded evidence and summary. Exercise the git and report outcomes in `pr-review.test.ts`.
- [x] 1.6 Export the host reader from `packages/core/src/index.ts`. Verify affected adapters typecheck against the export.

## 2. Pipeline and clipboard

- [x] 2.1 Add PR review action vocabulary in `packages/core/src/action-vocabulary.ts`. Verify its command ID derives from its title.
- [x] 2.2 Define the read-only action and typed reply in `packages/core/src/change-actions.ts`. Verify action availability and browser type export.
- [x] 2.3 Carry the Core report in `packages/server/src/change-actions-rest.ts`. Verify the authenticated change-action response uses the selected change's worktree.
- [x] 2.4 Render the report and copy the summary in `packages/webui/src/components/ChangeActionDialog.tsx`. Verify copied text matches the returned summary.
- [x] 2.5 Contribute Show PR Review in `packages/extension/package.json`. Verify the command matches the Core action.
- [x] 2.6 Register Show PR Review in `packages/extension/src/commands.ts`. Verify the selected change is read from its worktree and the copy action writes the returned summary.
- [x] 2.7 Add release notes for `openspec-ui-vscode` and `@openspec-ui/server` in `.changeset/review-change-before-pr.md`. Verify the notes with the release-note parser.

## 3. Integration

- [x] 3.1 Run the targeted Core PR review, forge, audit and Harness evidence tests, changed-source ESLint, and the affected Core, Web UI, server and extension TypeScript project checks. Record the commands and results.
- [x] 3.2 Exercise Show PR Review and Copy PR summary in the real standalone browser. Record the selected Playwright test and its result.
- [x] 3.3 Exercise the Show PR Review command in a real VS Code extension host. Record the selected smoke test and its result.
- [x] 3.4 Run `openspec validate review-change-before-pr --strict` and record the result.

## Verification evidence

- Core Vitest passed for `pr-review.test.ts`, `action-vocabulary.test.ts`, `change-actions.test.ts`, `gh-pr-list.test.ts`, `http-forges.test.ts` and `github-api-forge.test.ts`. The selected `verify records what its checks found` and `buildVerifyQuality` tests passed, including the audit writer stamping a clean commit.
- Server `change-actions-rest.test.ts` and extension `commands.test.ts` and `webview/pipeline-panel.test.ts` passed. The affected Core, Web UI, server and extension TypeScript projects passed. ESLint passed on the changed TypeScript paths.
- Web UI `codicons.test.ts` and `PipelineView.actions.test.tsx` passed.
- Standalone Playwright `pipeline.spec.ts -g 'opens a worktree PR review'` passed. The local server served the change worktree's patch and the browser clipboard contained the corresponding Markdown summary.
- VS Code 1.146.0 Extension Development Host passed `opens PR Review and copies its summary` with `OPENSPEC_UI_INTEGRATION_GREP`. It opened the report and wrote the summary through the editor clipboard.
- `node --test scripts/release-notes.test.mjs`, `node scripts/check-changesets.mjs` and `openspec validate review-change-before-pr --strict` passed.
