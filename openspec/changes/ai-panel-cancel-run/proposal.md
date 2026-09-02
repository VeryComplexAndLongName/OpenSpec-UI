## Why

Found live on 2026-09-02, while attempting `harness-cancel-stops-the-run`'s
own human-only verification: a single-stage run cannot be cancelled at
all.

`Cancel` exists in exactly one place —
`packages/webui/src/components/HarnessChainPanel.tsx`, rendered when
`isRunning && !pendingCheckpoint`. That panel drives a **chain**, and
`HarnessChainRunner` refuses to chain under `autonomyLevel: "assisted"`,
which is what this repository's own `openspec/agent-harness.json` sets. So
the button appears only under `semi-autonomous` or `autonomous`.

`AiPanel.tsx` — the panel a single stage runs through — has no cancel
control, despite its own header comment reading *"Displays the event
stream with the ability to cancel."*

There is no command-palette route either. `openspec-ui.cancelProcess`
("OpenSpec UI: Cancel Process") calls
`deps.implementationSessions.cancel(item.process.id)` — the Workbench
implementation-session path, not the harness's `RunController` — and its
menu is bound to a tree item (`when: viewItem ==
openspec-ui.cancellableProcess || viewItem ==
openspec-ui.implementationProcess`).

The result is that `harness-cancel-stops-the-run` shipped working
cancellation — an `AbortSignal` through `spawnAndStream`, process-tree
termination, and a runner that no longer spawns a second agent to ask the
first to stop — and the path most runs actually take cannot reach any of
it. On 2026-09-01, before that work, a stage had to be killed by hand from
the process list; for a single stage, that is still the only option.

Everything needed already exists. `RunController.cancel()` sends
`{ ...this.activeCommand, kind: "cancel" }`; `AiPanel` already holds the
active run in `runIdRef.current` and already computes `isRunning`;
`HarnessChainPanel`'s `sendOnCurrentRun("cancel")` is four lines. What is
missing is the control.

## What Changes

- `packages/webui/src/components/AiPanel.tsx`: a Cancel button beside
  Run, shown while a run is in flight, sending a `cancel` command on the
  active `runId` through the same transport the run was started on.
- `packages/extension/package.json` and `commands.ts`:
  `openspec-ui.cancelProcess` is renamed to say what it actually cancels,
  so a command titled "Cancel Process" no longer covers one of the two
  kinds of process this product runs.
- No change to `RunController`, to the protocol, or to any cancellation
  behavior — `harness-cancel-stops-the-run` already made a `cancel`
  command stop the run it names.

## Capabilities

### New Capabilities

(none — this extends `shared-ui` and `vscode-extension`)

### Modified Capabilities

- `shared-ui`: a run started from the AI panel can be cancelled from it.
- `vscode-extension`: the command that cancels a process names which kind
  of process it cancels.

## Impact

- `packages/webui/src/components/AiPanel.tsx` and its test.
- `packages/extension/package.json`, `commands.ts`, and their tests.
- Both delivery targets, because `AiPanel` is shared: the standalone UI
  and the VS Code webview gain the same control from one change.

## Explicitly out of scope

- Changing what cancellation does. That shipped in
  `harness-cancel-stops-the-run`; this change only makes it reachable.
- Cancelling from the Processes tree for harness runs. The tree's existing
  action belongs to implementation sessions, and giving it a second
  meaning is a larger decision about what that view represents.
- Making a chain runnable under `assisted`. The refusal is deliberate
  (`agentic-harness-autonomy`), and this change removes the reason it was
  being worked around.
