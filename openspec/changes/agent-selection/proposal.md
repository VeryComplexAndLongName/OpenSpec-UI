## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` decision #1 states
core is "the single source of truth for behavior"; `AGENT_REGISTRY` and
`buildDefaultAgentRunners()` already implement exactly that for
multi-agent execution (Claude CLI/Copilot CLI/Codex CLI/Gemini CLI/local
LLM), with the allowlist/audit security model decision #4 requires. This
is a specific gap found in review of this repository: **none of the
product's real entry points actually call `buildDefaultAgentRunners()`**.
`packages/server/src/cli.ts` (the standalone launcher), `optional-server.ts`
(VS Code's optional local-server mode), and `extension.ts`'s primary
message-bridge mode (`resolveRunner: () => undefined`) all leave the
runners map empty or absent. `AiPanel`'s own `RUNNABLE_COMMANDS` never
included `plan`/`implement`/`review` in the first place, so no UI path
ever exercised this even if runners were wired. The only way this product
actually invokes AI today is VS Code's native Chat/Agent mode
(`workbench.action.chat.open`, the `openspec` Chat Participant's
`request.model`) — entirely outside this app's own multi-agent
infrastructure, and unavailable in standalone at all (no chat panel
there). Standalone users currently have no way to invoke an agent through
this product whatsoever.

## What Changes

- Wire `buildDefaultAgentRunners({ workspaceRoot, allowExternalCwd })`
  into all three real entry points: `cli.ts`, `optional-server.ts`, and
  `extension.ts`'s message-bridge `resolveRunner`.
- Add `"plan"`, `"implement"`, `"review"` to `AiPanel`'s runnable/
  change-required command sets, and add an **agent picker** (`<select>`
  sourced from `AGENT_REGISTRY`, defaulting to `DEFAULT_AGENT_ID`) whose
  value is sent as `Command.agentId`.
- This makes AiPanel a single, host-agnostic place where switching agents
  works identically in the standalone browser tab and in both VS Code
  Webview modes (message-bridge and optional local-server) — additive to,
  not a replacement for, VS Code's existing native Chat/Agent path
  (`startImplementation`, the Chat Participant), which is untouched.
- Document the mechanism (what it is, how it differs from VS Code's native
  Chat/Agent mode, and that each CLI tool must already be installed and
  authenticated on the machine) in `README.md` and the relevant package
  READMEs.

## Capabilities

### New Capabilities

(none — this activates and exposes an already-specified capability; see
Modified Capabilities.)

### Modified Capabilities

- `standalone-app`: the standalone shell can now invoke an AI agent at
  all (previously impossible — no runners were ever wired into `cli.ts`).
- `vscode-extension`: the message-bridge Webview mode can now resolve a
  real runner instead of always failing with "AI agent execution is
  disabled in direct OpenSpec mode."

## Impact

- `packages/server/src/cli.ts`, `packages/server/src/optional-server.ts`.
- `packages/extension/src/extension.ts` (`resolveRunner`).
- `packages/webui/src/components/AiPanel.tsx` (command set, agent
  picker), `packages/core/src/agents/registry.ts` (move `DEFAULT_AGENT_ID`
  here so it is browser-safe, re-exported from `browser.ts`).
- `README.md`, `packages/server/README.md`, `packages/extension/README.md`
  (documentation only).
- No change to the command/event protocol shape — `agentId` is already an
  existing, optional `Command` field; this only starts populating and
  honoring it end to end.
