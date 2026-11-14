# Tasks

## 1. Feedback

- [x] 1.1 Define the issue draft URL and format allowed metadata in `packages/core/src/user-feedback.ts`. Verify that only the preview fields are included.
- [x] 1.2 Implement the preview and copy controls in `packages/webui/src/components/SendFeedback.tsx`. Verify the copied content and issue destination.
- [x] 1.3 Expose feedback in `packages/webui/src/standalone-entry.tsx`. Verify the standalone version facts and failed-run entry point.
- [x] 1.4 Expose feedback in `packages/webui/src/extension-entry.tsx`. Verify the extension webview version facts and failed-run entry point.
- [x] 1.5 Use the shared preview on failure in `packages/webui/src/components/AiPanel.tsx`. Verify the failed run's category reaches the preview.
- [x] 1.6 Use the shared preview on failure in `packages/webui/src/components/HarnessChainPanel.tsx`. Verify the failed chain's category reaches the preview.

## 2. First run and release

- [x] 2.1 Register Diagnose Workspace in `packages/extension/src/commands.ts`. Verify the native report renders the Core findings and remedies.
- [x] 2.2 Add the command to `packages/extension/src/tree/workspace-tree.ts`. Verify the Workspace row names and invokes the contributed command.
- [x] 2.3 Add release notes for both deliveries in `.changeset/make-workbench-feedback-easy.md`. Verify the changeset parser.
- [x] 2.4 Record strict OpenSpec validation, selected Core, Web UI and extension tests, scoped lint and TypeScript checks.
- [x] 2.5 Record a standalone browser smoke for the feedback preview and an Extension Development Host smoke for Diagnose Workspace.

## Verification evidence

- Core action vocabulary, message register and environment report tests passed. Web UI Send Feedback, AI Panel, Harness Chain Panel, App Bar and control vocabulary tests passed. Extension commands and Workspace tree tests passed.
- Core, Web UI, server and extension TypeScript checks passed, as did ESLint on changed TypeScript files, the changeset check and the release-note parser tests.
- Playwright `lifecycle-execution.spec.ts -g 'previews and copies diagnostics'` passed against the real server. The browser copied the same four fields to the clipboard without the failure text.
- VS Code 1.146.0 Extension Development Host passed `opens Workspace diagnosis with local findings` with a scoped Mocha grep. The report showed the fixture's Node requirement and its remedy.
- The Workbench Core adapters passed `init`, strict change validation and archive in a disposable workspace with OpenSpec CLI 2.0.0. Initialization installed the six skills and archive created the canonical capability spec.
- `openspec validate make-workbench-feedback-easy --strict` passed.
