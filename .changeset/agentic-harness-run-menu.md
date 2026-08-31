---
"@openspec-ui/core": patch
"@openspec-ui/server": patch
"@openspec-ui/webui": patch
"openspec-ui-vscode": minor
---

Add a discoverable "Run with Agentic Harness" entry point for the chain
execution `agentic-harness-autonomy` introduced: a new context-menu command
(`openspec-ui.runWithHarness`) in the VS Code extension, and a matching
button in the standalone shell's Change Editor tab. Both resolve the
selected change's Agentic Harness configuration fresh on every invocation
and dispatch accordingly — the existing Agent Selection picker for
`assisted`, or the `HarnessChainPanel` chain view for `semi-autonomous`/
`autonomous` — without ever overriding what that configuration says.

See `openspec/changes/agentic-harness-run-menu/` for the full design. No
protocol change — this is purely a discoverable trigger over what
`agentic-harness-autonomy` already exposes.
