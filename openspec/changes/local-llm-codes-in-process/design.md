## Context

See `proposal.md` and ADR 0038. What exists:

- `AcpSessionDriver.run()` takes an `AcpConnectTarget`, which is either a
  stdio `Stream` or an in-process `AgentApp`. Only the tests use the
  second today. `runProcess()` spawns a process and calls `run()` with its
  stdio.
- `local-llm` is a one-shot HTTP adapter with no tools.
- `local-llm-acp` (change `local-llm-acp`, PR #803) starts
  `coding-agent --base-url <url> --model <name> [limits] acp`.
- `coding-agent` 0.3.0 (repository `CodingAgent`, its ADR 0002) is a
  working reference: the agent loop, the tools, the ACP surface and the
  text-call reader were verified live against SGLang serving Qwen3.6 on
  2026-10-01 (run `live-local-llm-acp-1790853181423`).
- The local LLM's base URL, model and key resolve from the host, then
  the environment, then defaults (`resolveLocalLlmSettings`).
- A model is accepted for an agent only where its registry entry has a
  `modelFlag` (`harness-config.ts`, `harness-config-schema.ts`,
  `harness-settings-parts.tsx`).
- Nothing in the product handles a proxy.

## Goals / Non-Goals

**Goals:**

- A local model makes a change from both hosts with nothing installed but
  the product.
- Its tools are confined to the run's `cwd`, and every call is seen.
- Tool calls are read whether the server parsed them or not.
- A person may name the model, and need not.
- A person can tell agents to ignore the system proxy.

**Non-Goals:**

- No new command kind or event kind. The agent speaks ACP; `agentUpdate`,
  `permissionRequest` and `usageReported` already carry what it says.
- No MCP servers for the in-process agent; `mcpServers` is accepted and
  ignored, as `coding-agent` does.
- No change to `local-llm`'s one-shot chat, except how its model is chosen
  and its proxy.
- No change to the server's tool-call parser (DocsAI keeps `hermes`).
- No per-host proxy list. One switch, and the agents that can honour it.
- `coding-agent` is not deleted or changed; this product stops using it.

## Decisions

1. **An in-process `AgentApp`, driven by the existing `AcpSessionDriver.run()`.**
   - Chosen: `LocalLlmAcpAdapter` builds an `AgentApp` and runs it through
     `driver.run({ target: agentApp, ... })`.
   - Rejected: a new adapter shape that emits events directly. It would
     duplicate the ACP translation, permission routing and usage handling
     the driver has, which ADR 0013 put in one place.
   - Rejected: spawning a bundled Node script over stdio. A process
     boundary buys nothing in process and costs startup, a second
     termination path and an allowlist entry for our own file.

2. **The invocation is `{ kind: "in-process" }`, not a process.**
   - Chosen: `AdapterInvocation` gains an `in-process` kind. The allowlist
     check accepts it only for an adapter registered as in-process, and
     the audit records it as such.
   - Rejected: reusing `kind: "http"` with a fake URL. The audit would
     record something that never happened.
   - Protocol compatibility: `AdapterInvocation` is core-internal; no
     server or extension adapter reads its kinds, and no wire format
     changes.

3. **Tools are ported from `coding-agent`, sandboxed by real path.**
   - Chosen tools: `read_file`, `write_file`, `replace_text`, `list_dir`,
     `search_text`, `run_command`.
   - Not ported: git, background processes, delete and move. A run that
     needs them can use `run_command`. Fewer tools leave the model less to
     choose wrongly among.
   - Every path is resolved with `realpath` (the parent's, for a file not
     yet written) and refused unless inside `realpath(cwd)`. This is the
     check `security.ts` already uses for change artifacts.
   - `run_command` runs through the platform shell in `cwd`, with the
     `commandTimeoutSeconds` limit (default 60) and a
     `maxCommandOutputChars` cap (default 12000). On Windows the timeout
     kills the process tree with `terminateProcessTree`, as cancellation
     does.
   - Rejected: no `run_command`. A coding agent that cannot run the tests
     it writes cannot verify a task, and `tasks.md` items here are
     verified by commands.

4. **Commands ask first only when a person said so.**
   - Chosen: `openspec-ui.localLlm.agent.askBeforeCommands` (default
     false; `OPENSPEC_UI_LOCAL_LLM_ASK_BEFORE_COMMANDS=1`). When true,
     `run_command` sends `session/request_permission` and runs only on
     allow. Writes inside `cwd` never ask.
   - Rejected: always ask. A chain under `autonomous` has nobody to
     answer, and the run would stall at its first command (`config.yaml`:
     a run never waits for a human).
   - Rejected: never offer asking. Then the one agent that could honour a
     permission gate would not, which the README already says of two
     others.

5. **Tool calls are read from the text when the server did not parse them.**
   - Chosen: a port of `coding-agent`'s `tool_calls_in_text`. It reads
     `<tool_call>` blocks in Qwen3-Coder's XML form or Hermes' JSON, takes
     only offered tools, and reads a parameter as JSON only where the
     tool's schema declares an array or an object.
   - Rejected: require the server's parser to match. The product cannot
     configure the server, and on the LAN it is configured otherwise.

6. **The model: stage, then settings, then `/v1/models`, then `default`.**
   - Chosen: `AgentDescriptor` gains `acceptsModel` (true where
     `modelFlag` is set, and for `local-llm` and `local-llm-acp`). The
     three places that read `modelFlag` to decide acceptance read
     `acceptsModel` instead. The stage's model wins. Otherwise
     `resolveLocalLlmSettings`. Otherwise `GET <base>/v1/models` (with the
     key, 10 s), taking the only model when one is served and the first
     when several are, and saying which in the run's first update.
     Otherwise `default`.
   - The answer from `/v1/models` is cached per base URL for the life of
     the host process, so a chain asks once.
   - Rejected: make the model required. The owner asked for optional, and
     a server serving one model needs no name.

7. **Ignoring the system proxy: one switch, honoured where it can be.**
   - Chosen: `openspec-ui.agents.ignoreSystemProxy` (default false) and
     `OPENSPEC_UI_IGNORE_SYSTEM_PROXY=1`, read into
     `DefaultRunnersConfig.ignoreSystemProxy`.
   - When on, every request the local LLM agents and the availability
     check make goes through a dedicated `undici` `Agent` with no proxy,
     using `undici`'s own `fetch`, not the global one. The editor host may
     have replaced the global `fetch` and dispatcher to apply its proxy.
   - When on, `spawnAndStream` and `spawnAcpProcess` give a CLI an
     environment without `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` (either
     case) and with `NO_PROXY=*`.
   - `HarnessAgentCapabilities` gains `systemProxy`: `"ignored"` for the
     in-process agents, `"environment"` for a CLI known to read the
     variables, `"unknown"` otherwise, and a finding states it when the
     switch is on.
   - Rejected: a host list. The owner asked for "ignore", and a list
     would be a second network configuration to get wrong.
   - Rejected: always direct for the local LLM. A model reached only
     through a proxy would be lost.

## Risks / Trade-offs

- [Risk] The product now runs commands itself → mitigation: `cwd`
  confinement by real path, a time limit, an output cap, every call
  logged as a tool-call update, the optional permission prompt, and tests
  that try `..`, absolute paths and links.
- [Risk] A text-call reader can take something that was not meant as a
  call → only offered tools, only inside `<tool_call>`, and the text is
  kept when nothing parses.
- [Risk] `/v1/models` names a model a person did not mean → the run's
  first update says which model was chosen and from where.
- [Risk] Removing `HTTP_PROXY` breaks a CLI that needs the proxy to reach
  its own vendor → the switch is off by default and is described as
  applying to every agent.
- [Risk] `undici` becomes a direct dependency of `core` → it is the
  library Node's own `fetch` is built on, pinned to the version the
  pinned Node ships.
- [Trade-off] Fewer tools than `coding-agent` (no git, no background
  processes) → `run_command` covers them.

## Migration Plan

1. `local-llm-acp` lands and is archived (blocked_by).
2. The in-process agent replaces the external process under the same id.
   The `coding-agent` allowlist entry and the executable setting go.
3. Settings and schema changes ship in the same release. A harness file
   that set no model behaves as before. One that set a model for
   `local-llm` or `local-llm-acp` was refused before and is accepted now.

## Open Questions

- Whether the permission prompt should also cover writes outside
  `openspec/changes/<id>/` for a `plan` command. Out of scope here: the
  propose stage's instruction already forbids them.
