## Why

`openspec/changes/agentic-harness-autonomy/` (depends on
`docs/adr/0012-agentic-harness-chain-execution-protocol.md` being Accepted)
adds the `"chain"`/`"confirmCheckpoint"` protocol members and a minimal
`HarnessChainPanel` component, but deliberately ships no discoverable entry
point — a user cannot start a chain without already knowing the internal
component exists. This change is the discoverable entry point: a "Run with
Agentic Harness" action on a change, in both delivery targets, that
resolves the change's harness config and starts the appropriate flow
(single-stage picker pre-fill for `assisted`, a chain for `semi-autonomous`/
`autonomous`) — the concrete ask from the same conversation that produced
ADR 0012.

## What Changes

- New context-menu / command entry on a change: "Run with Agentic
  Harness" — VS Code: `openspec-ui.runWithHarness` in the Changes tree
  context menu (alongside the existing `openspec-ui.configureHarnessForChange`
  entry); standalone webui: an equivalent button in the Change Editor /
  Overview view for the selected change. Per ADR 0001, both delivery
  targets get the same capability from the shared `packages/webui`
  component, not independently reimplemented chrome.
- Behavior resolves the change's harness config first:
  - `assisted`: opens the existing Process Dashboard / AI panel for that
    change (reuses the existing `stepAgents` pre-fill behavior for
    whichever stage the user then selects — no new stage auto-selection
    and no new execution path for this level).
  - `semi-autonomous`/`autonomous`: opens `HarnessChainPanel`
    (`agentic-harness-autonomy`) and starts a `"chain"` command for the
    change.
- No new business logic beyond resolving which of the two above to do —
  that resolution itself is a thin dispatch on already-resolved
  `HarnessConfig.autonomyLevel`, not new domain logic.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness`, `shared-ui`, and `vscode-extension`)

### Modified Capabilities

- `agentic-harness`: adds a discoverable entry point (the requirement that
  a "Run with Agentic Harness" action exists and dispatches by autonomy
  level).
- `shared-ui`: new shared action/button component consumed by both hosts.
- `vscode-extension`: new command + context-menu contribution.

## Impact

- `packages/webui/src/components/`: new shared "Run with Agentic Harness"
  action, consumed by both `standalone-entry.tsx` and the extension's
  webview host.
- `packages/extension/src/commands.ts` (new `runWithHarness` command),
  `packages/extension/src/tree/changes-tree.ts` (context-menu entry),
  `packages/extension/package.json` (command/menu contribution).
- `openspec/specs/agentic-harness/spec.md`: new requirement for the entry
  point's dispatch behavior.
- Depends on `agentic-harness-autonomy` being implemented first (consumes
  its `"chain"` protocol members and `HarnessChainPanel`); do not start
  this change's tasks before that one is at least far enough along that
  its protocol/component shape is stable — see tasks.md 0.
