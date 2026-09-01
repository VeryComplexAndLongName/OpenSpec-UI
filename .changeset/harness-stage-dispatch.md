---
"@openspec-ui/core": minor
---

Agentic Harness `stepAgents` entries may now declare `dispatch: "vscode-chat"` (alongside the existing `"cli"`, the default) to hand a stage's prompt to VS Code's own chat instead of spawning a CLI subprocess — the same `workbench.action.chat.open` dispatch `openspec-ui.startImplementation` already used, now reachable through the harness. Valid only under `autonomyLevel: assisted`, and only in the VS Code delivery target; resolving it in the standalone server is a configuration error rather than a silent fallback to a CLI. Such a stage emits `started` followed by a new non-terminal `handedOff` event, never `completed` — nothing observes the chat session's work. Existing configurations are unaffected: absent `dispatch`, every stage behaves exactly as before.
