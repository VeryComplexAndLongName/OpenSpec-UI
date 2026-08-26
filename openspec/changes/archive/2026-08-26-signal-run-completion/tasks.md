## 1. VS Code extension

- [x] 1.1 Add `packages/extension/src/run-notifications.ts`:
  `RunCompletionNotifier` (tracks last-seen state, reports newly-terminal
  `plan`/`implement`/`review` processes) and `describeRunCompletion`.
- [x] 1.2 Wire it into `extension.ts` via `scheduler.onDidChange`, seeded
  from `scheduler.list()` before the listener is registered; show
  `vscode.window.showInformationMessage`/`showErrorMessage` with a
  "View" action opening `openspec-ui.openAiPanel`.
- [x] 1.3 Add `packages/extension/src/run-notifications.test.ts` covering:
  fresh completion/failure, no re-notification on a later update, no
  notification for a process already terminal when first seen, no
  notification for non-agent operations, no notification for cancelled/
  interrupted/rolled-back.

## 2. Standalone app

- [x] 2.1 Add `packages/webui/src/notify-run-completion.ts`:
  `AGENT_COMMANDS` (moved here as the single source of truth) and
  `describeRunCompletionNotification`.
- [x] 2.2 Add an optional `onRunTerminal` prop to `AiPanel`, called for
  the active run's `completed`/`failed` events when its command kind is
  in `AGENT_COMMANDS`, via a ref capturing the command kind at run-start
  time (not the `commandKind` UI state).
- [x] 2.3 Wire it up in `standalone-entry.tsx`, gated to
  `isStandaloneHost`: request `Notification` permission lazily, show a
  browser notification once granted. Not wired up for the VS Code
  local-server iframe embed.
- [x] 2.4 Add `packages/webui/src/notify-run-completion.test.ts` covering
  completed/failed descriptions, non-agent commands, and non-terminal/
  cancelled events.

## 3. Spec

- [x] 3.1 Add the `ADDED Requirements` delta to
  `openspec/specs/persistent-workbench-runs/spec.md` via
  `specs/persistent-workbench-runs/spec.md` in this change.

## 4. Verification

- [x] 4.1 `npm run typecheck` passes workspace-wide.
- [x] 4.2 `npm run lint` (including `lint:english`) passes workspace-wide.
- [x] 4.3 `npm run test` passes workspace-wide, including the new test
  files.
- [x] 4.4 Rebuild the VSIX (`npm run package --workspace
  openspec-ui-vscode`) and confirm it packages without error after the
  `extension.ts` changes.
- [x] 4.5 A live Extension Host smoke test was not performed:
  `npm run test:integration --workspace openspec-ui-vscode` currently
  fails on this development machine with an unrelated, pre-existing
  environment issue (`Cannot find module ...Temp\openspec-ui-integration-*`,
  reproduced identically against unmodified `main`, tracked as a known
  local-machine-only issue, not caused by this change).
- [x] 4.6 Propose a changeset (`npx changeset`) for `openspec-ui-vscode`
  and `@openspec-ui/webui` (both minor: new capability, no breaking
  change) instead of hand-editing `version`/`CHANGELOG.md`; apply it via
  `npx changeset version`.
- [x] 4.7 Run `openspec change validate --strict signal-run-completion`.
