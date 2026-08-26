## Why

Raised directly by the user during a repository review session on
2026-08-25/26, and confirmed by code inspection: neither delivery target
notifies the user when a `plan`/`implement`/`review` run finishes.
`packages/extension/src/run-controller.ts` emits `completed`/`failed`
events, and `packages/webui/src/components/AiPanel.tsx` receives them, but
nothing surfaces a notification through either host's own notification
system -- a user who starts a run and looks away (the exact scenario the
user described: "launch several different changes and walk away") only
finds out by returning to the Processes view or the AI panel and looking.
Every existing notification in `commands.ts` fires synchronously for a
command the user just triggered themselves; this is the one gap where the
user isn't necessarily present when the state actually changes.

## What Changes

- VS Code extension: `packages/extension/src/run-notifications.ts`
  (`RunCompletionNotifier`) tracks each process's last-seen state via
  `WorkbenchProcessScheduler.onDidChange` and reports processes that just
  transitioned into `completed`/`failed` for a `plan`/`implement`/`review`
  operation. `extension.ts` wires this to `vscode.window
  .showInformationMessage`/`showErrorMessage` with a "View" action that
  opens the Process Dashboard (`openspec-ui.openAiPanel`).
- Standalone app: `AiPanel` gains an optional `onRunTerminal` prop, called
  for the same filtered set of terminal events on the currently active
  run, without importing any browser or VS Code API itself (stays
  transport- and host-neutral per ADR 0001).
  `packages/webui/src/notify-run-completion.ts`
  (`describeRunCompletionNotification`) is the shared pure filter/
  formatter, used by `standalone-entry.tsx` to show a browser
  `Notification` once permission is granted (requested lazily, not
  unprompted on load). Not wired up for the VS Code local-server iframe
  embed -- that host already gets a native notification from the
  extension side, and iframe `Notification` permission is unreliable.
- Deliberately excluded from notifying: `status`/`list`/`show`/`validate`
  (near-instant, no "walked away" scenario) and `cancelled`/`interrupted`/
  `rolled-back` (almost always the direct result of an action the user
  just took, or a recovery-time artifact from a prior session -- restored
  processes are seeded as already-known so they never re-fire on
  activation).
- Adds a Requirement to `persistent-workbench-runs` (the spec capability
  already covering cross-delivery-target Workbench process behavior) --
  see `design.md` for what was deliberately left out of scope.
- First real use of the newly adopted Changesets workflow: see the
  archived `fix-changesets-private-packages-config` change for a
  configuration bug this surfaced and fixed along the way.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `persistent-workbench-runs`: terminal `plan`/`implement`/`review` run
  state now triggers a host-native notification, in addition to the
  existing Processes-view/AI-panel visibility.

## Impact

- `packages/extension/src/run-notifications.ts` (new)
- `packages/extension/src/run-notifications.test.ts` (new)
- `packages/extension/src/extension.ts`
- `packages/webui/src/notify-run-completion.ts` (new)
- `packages/webui/src/notify-run-completion.test.ts` (new)
- `packages/webui/src/components/AiPanel.tsx`
- `packages/webui/src/standalone-entry.tsx`
- `openspec/specs/persistent-workbench-runs/spec.md` (delta below)
