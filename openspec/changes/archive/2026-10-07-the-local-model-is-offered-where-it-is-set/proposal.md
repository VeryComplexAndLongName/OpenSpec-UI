## Why

Asked by the owner on 2026-10-06: after **Initialize OpenSpec**, the
Agentic Harness setup offered no `local-llm` or `local-llm-acp`.

The first step, Initialize OpenSpec, is right not to: its list is
`openspec init --tools`, the assistants OpenSpec writes command and skill
files for, and the local agents are built into this product and need none.

The second step, **Set Up Agentic Harness**, offers only the agents
detection found, and the extension asked detection with nothing. The local
LLM was then looked for at the environment's address or
`http://localhost:30000`, never at `openspec-ui.localLlm.baseUrl`, so a
server on the LAN named in the settings was not found and its agents were
not offered. The AI panel and the repository-setup facts asked the same
way.

## What Changes

- The extension reads where the local LLM is - `openspec-ui.localLlm.baseUrl`,
  the key in the secret storage, `openspec-ui.agents.ignoreSystemProxy` -
  in one module, at the moment detection asks, and every detection in the
  extension (the Agentic Harness setup, the AI panel, the
  repository-setup facts) is asked with it. The runners read the same
  module.
- The Agentic Harness setup offers the local coding agent always: it needs
  nothing installed, and a server that does not answer now may simply not
  be running yet; where it does not answer, the list says so. It does not
  offer `local-llm`, which edits no file, for stages whose work is files,
  and the configuration's findings say where one is on such a stage. The setup therefore always asks its questions; it no longer skips
  them when no CLI is found.

## Capabilities

### Modified Capabilities

- `vscode-extension`: detection uses the editor's local LLM settings; the
  Agentic Harness setup offers the local coding agent.
- `agentic-harness`: a configuration says where its agent can write
  nothing.

## Impact

- `packages/extension`: `local-llm-settings.ts` (new), `extension.ts`,
  `commands.ts`, `webview/ai-panel.ts`, `repo-setup-facts.ts`, and their
  tests.
- The standalone server already detects at its configured address, and its
  AI panel lists every agent with its detection; nothing changes there.
