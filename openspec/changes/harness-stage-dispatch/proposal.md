## Why

Implements `docs/adr/0016-harness-stage-dispatch-via-vscode-chat.md`
(Accepted 2026-09-01), which records the decision and the alternatives.

Short version: every harness stage today runs as a spawned CLI, and a
headless process has nobody to answer its permission prompts. That cost
this repository `claude-cli-permission-bypass`
(`--dangerously-skip-permissions`) and left `copilot-cli` unusable for
real work here — reproduced identically from a plain shell, the VS Code
extension host, and the standalone server, so not a defect in this
product. Meanwhile `openspec-ui.startImplementation` already hands a
prompt to VS Code's own chat, where a human approves each action in a
real UI and the work is billed to the user's IDE subscription rather
than API credits. That dispatch works; it simply cannot participate in
the harness.

## What Changes

- `packages/core/src/harness-step-agent.ts`: a stage entry's object form
  gains `dispatch?: "cli" | "vscode-chat"`, defaulting to `"cli"`.
- `packages/core/src/harness-config.ts`: validation — the value must be
  one of the two, and `"vscode-chat"` is rejected unless the resolved
  `autonomyLevel` is `assisted` (ADR 0016: a chain cannot use it).
- `packages/core/src/protocol.ts`: a new non-terminal `EventKind`
  member for "this stage was handed to the host's chat", so a handed-off
  stage is not reported as if it had been observed.
- `packages/extension/src/webview/ai-panel.ts`: when a stage resolves to
  `vscode-chat`, build the prompt and call
  `workbench.action.chat.open` instead of the `AgentRunner`, emitting
  `started` and the hand-off event.
- `packages/server`: reject `"vscode-chat"` when it resolves a stage —
  the standalone target cannot honour it, and ADR 0016 requires an error
  rather than a silent fallback to CLI.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agentic-harness`: a stage may be dispatched through the host's chat
  instead of a spawned CLI, under `assisted` only, in the VS Code target
  only.
- `execution-core`: one additional non-terminal event kind for a
  handed-off stage.

## Impact

- `packages/core/src/harness-step-agent.ts`, `harness-config.ts`,
  `protocol.ts`; `packages/extension/src/webview/ai-panel.ts`;
  `packages/server`'s harness-config resolution; and their tests.
- No `webui` behavior change beyond rendering the new event kind, which
  its existing structured-event renderer already handles generically.
- No change to any existing configuration: absent `dispatch`, every
  stage behaves exactly as today.
