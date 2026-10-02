## Why

[ADR 0038](../../../docs/adr/0038-the-local-model-codes-in-the-product.md).
A model on a person's own network can chat (`local-llm`) but cannot make a
change unless that person finds, installs and keeps in step a separate
Python agent, `coding-agent`, which `local-llm-acp` starts. For every user
but its author that agent reads "not detected". Its tools also sit outside
this product's allowlist, sandbox and permission prompt, and it writes and
runs without asking.

Two more things, from the live runs of 2026-10-01 against SGLang serving
Qwen3.6:

- The model's tool calls arrived as text in `content`: the server's
  `hermes` parser does not recognise Qwen3-Coder's
  `<function=...><parameter=...>` form (0 of 6 structured calls when
  measured). An agent for local models has to read them there.
- On the maintainer's machine the system proxy resets every request to the
  LAN, and nothing lets a person tell an agent to go direct.

And one request from the owner: the model a local agent uses should be a
name a person may give, and need not give.

## What Changes

- **`local-llm-acp` becomes an agent that runs inside `packages/core`**: an
  Agent Client Protocol agent in TypeScript, connected in process through
  the existing `AcpSessionDriver`. It runs a tool loop against the local
  LLM's `/v1/chat/completions` with tools to read, write, replace in a
  file, list, search, and run a command. Every tool call streams as an ACP
  update. Same id, so harness files keep working. The external
  `coding-agent` process, its allowlist entry and its executable go.
- **Its tools stay in the run's working directory**: a path whose real
  location is outside `cwd` is refused, links included. A command runs in
  `cwd` with a time limit and an output cap. By default commands run
  without asking, like the other agents here; a setting makes it ask
  through the protocol's permission request, which both hosts show.
- **It reads a tool call wherever the model put it**: structured
  `tool_calls` first, else a call to an offered tool written as text
  inside `<tool_call>`, in Qwen3-Coder's XML form or Hermes' JSON.
- **The model is named or found** for `local-llm` and `local-llm-acp`. A
  stage may name it (`stepAgents.<stage>.model`), as for CLIs that take
  `--model`. Otherwise the local LLM settings name it. Otherwise the agent
  asks the server's `/v1/models` and uses the model it serves. Otherwise it
  uses `default`, as today. The Harness Settings views offer the model
  field for both agents.
- **An agent can be told to ignore the system proxy**: one setting, off by
  default, `openspec-ui.agents.ignoreSystemProxy` in the editor and
  `OPENSPEC_UI_IGNORE_SYSTEM_PROXY=1` for the standalone server and the
  CLI. When on, the in-process agents and the local LLM's availability
  check connect directly. A CLI agent is started with the proxy variables
  removed from its environment and `NO_PROXY=*`, which reaches the agents
  that read them. Each agent's capability row says whether it does.
- The `LOCAL_LLM_ACP_*` limits keep their names and limit the in-process
  loop.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core`: the local LLM's coding agent, its tools and their
  sandbox, how it reads tool calls, how its model is chosen, and ignoring
  the system proxy.
- `agentic-harness`: a stage may name a model for `local-llm` and
  `local-llm-acp`.

## Impact

- `packages/core`:
  - a new in-process agent (agent loop, tools, sandbox, text-call reader)
    under `src/agents/`;
  - `local-llm-acp.ts` and `default-runners.ts` stop starting a process;
  - `local-llm-settings.ts` gains model discovery and the proxy setting;
  - `agents/registry.ts` and `harness-config.ts` let `local-llm` and
    `local-llm-acp` take a model;
  - `shared.ts` and `acp-session-driver.ts` give a spawned CLI an
    environment without proxy variables when asked;
  - `agent-detection.ts` checks the local LLM directly when asked.
- `packages/extension`: the `openspec-ui.agents.ignoreSystemProxy` and
  `openspec-ui.localLlm.agent.askBeforeCommands` settings, passed to
  `buildDefaultAgentRunners`; the agent-harness schemas accept a model
  for both agents.
- `packages/server`, `packages/cli`: the same two settings from the
  environment.
- `packages/webui`: the Harness Settings views show the model field for
  both agents.
- `HARNESS.md`, `LIMITS.md`, `README.md`.
- No command or event kind is added: the agent speaks ACP, whose updates
  and permission requests the protocol already carries.
- Blocked by `local-llm-acp`, which must land and be archived first: both
  change the local LLM's requirement in `execution-core`.
