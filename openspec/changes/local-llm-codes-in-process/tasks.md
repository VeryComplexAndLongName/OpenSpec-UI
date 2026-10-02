Requested by the owner on 2026-10-02: the local model's coding agent
lives in the product (ADR 0038), its model is optional, and agents can
ignore the system proxy. Blocked by `local-llm-acp`.

## 1. The decision

- [ ] 1.1 **Human-only**: the owner accepts ADR 0038 and this proposal;
  `docs/adr/0038-the-local-model-codes-in-the-product.md` then reads
  `Status: Accepted`, and `docs/adr/README.md`'s row says so.

## 2. The in-process agent

- [ ] 2.1 `packages/core/src/agents/local-agent/text-tool-calls.ts`:
  `toolCallsInText(content, parameterTypes)`, ported from
  `coding-agent`'s `tool_calls_in_text`. Test in `text-tool-calls.test.ts`:
  a Qwen3-Coder call, a Hermes call, JSON-looking file content kept as
  text, a tool not offered left as text.
- [ ] 2.2 `packages/core/src/agents/local-agent/sandbox.ts`:
  `resolveInside(cwd, path)` by real path, the parent's real path for a
  file not yet written. Test in `sandbox.test.ts`: `..`, an absolute path
  elsewhere, a link pointing outside, and a path inside, each answered.
  Do not resolve with `path.resolve` alone: a link inside `cwd` can point
  outside it.
- [ ] 2.3 `packages/core/src/agents/local-agent/tools.ts`: `read_file`,
  `write_file`, `replace_text`, `list_dir`, `search_text`, `run_command`,
  with their JSON schemas. `run_command` runs in `cwd` and ends a command
  at `commandTimeoutSeconds` through `terminateProcessTree`. Test in
  `tools.test.ts`: each tool, the output cap, the time limit, and a refused
  path.
- [ ] 2.4 `packages/core/src/agents/local-agent/chat-client.ts`: one
  `/v1/chat/completions` request with tools, reading `tool_calls`,
  `"tool_calls": null`, `"usage": null` and null arguments as none, then
  `toolCallsInText`. Test in `chat-client.test.ts` against a local HTTP
  stand-in.
- [ ] 2.5 `packages/core/src/agents/local-agent/agent-loop.ts`: the loop
  bounded by `LocalLlmAcpLimits`, giving progress events (text, tool call,
  tool result, usage) and a stop reason. Test in `agent-loop.test.ts`: a
  turn that writes a file, the iteration limit, the tool-call limit, a
  token limit.
- [ ] 2.6 `packages/core/src/agents/local-agent/acp-agent.ts`: an
  `AgentApp` serving `initialize`, `session/new` (the session's `cwd`),
  `session/prompt` (updates `agent_message_chunk`, `tool_call`,
  `tool_call_update`; response `stopReason` and `usage`) and
  `session/cancel` (ends the loop at its next step). With
  `askBeforeCommands`, `run_command` sends `session/request_permission`.
  Test in `acp-agent.test.ts` through `AcpSessionDriver.run()`, not around
  it: the events a run produces, a permission allowed and one denied, and
  a cancel.
- [ ] 2.7 `packages/core/src/agents/local-llm-acp.ts`:
  `LocalLlmAcpAdapter.buildInvocation` returns `{ kind: "in-process" }`,
  and `execute` runs the agent of 2.6 through `driver.run`. No process is
  started. `local-llm-acp.test.ts` asserts it.
- [ ] 2.8 `packages/core/src/agent-runner.ts` and `security.ts`:
  `AdapterInvocation` gains `in-process`. `checkAllowlist` accepts it only
  for an adapter registered as in-process, and the audit records the kind.
  `security.test.ts`: in-process accepted for `local-llm-acp`, refused for
  `claude-cli`.
- [ ] 2.9 `packages/core/src/default-runners.ts`: the `coding-agent`
  allowlist entry and `LOCAL_LLM_ACP_DEFAULT_EXECUTABLE` removed;
  `default-runners.test.ts` updated.

## 3. The model

- [ ] 3.1 `packages/core/src/agents/registry.ts`: `AgentDescriptor.acceptsModel`,
  true where `modelFlag` is set and for `local-llm` and `local-llm-acp`.
  `registry.test.ts`.
- [ ] 3.2 `packages/core/src/harness-config.ts` and
  `harness-config-schema.ts` decide acceptance by `acceptsModel`, not
  `modelFlag`. `harness-config.test.ts`: a model accepted for both local
  agents, still refused for `gemini-cli`.
- [ ] 3.3 `packages/core/src/local-llm-settings.ts`:
  `resolveLocalLlmModel(stageModel, settings, fetchModels)` (stage, then
  settings, then `/v1/models` cached per base URL, then `default`),
  returning the name and its source. `local-llm-settings.test.ts`: each
  source, one model served, several served, the server unreachable.
- [ ] 3.4 `packages/core/src/agents/local-llm.ts` and the agent of 2.6 use
  3.3, and the first update of a run names the model and its source.
- [ ] 3.5 `packages/webui/src/components/harness-settings-parts.tsx`
  offers the model field by `acceptsModel`. Test in
  `harness-settings-parts` or the view tests.
- [ ] 3.6 `packages/extension/schemas/agent-harness.schema.json` and
  `change-harness.schema.json`, regenerated from `harness-config-schema.ts`
  (as their header says), accept a model for both local agents.

## 4. The system proxy

- [ ] 4.1 `packages/core/src/local-llm-settings.ts` (or a new
  `direct-fetch.ts`): `localFetch(ignoreSystemProxy)` returns `undici`'s
  `fetch` with an `Agent` of its own when asked, and the global `fetch`
  otherwise. Test: with `ignoreSystemProxy` the request reaches a local
  stand-in while `HTTPS_PROXY` points at a closed port.
- [ ] 4.2 `packages/core/src/agents/shared.ts` and
  `acp-session-driver.ts`: `withoutSystemProxy(env)` removes
  `HTTP_PROXY`, `HTTPS_PROXY` and `ALL_PROXY` in either case and sets
  `NO_PROXY=*`. `spawnAndStream` and `spawnAcpProcess` use it when the
  runner was built with `ignoreSystemProxy`. Test: the environment passed
  to the spawn mock.
- [ ] 4.3 `packages/core/src/default-runners.ts`:
  `DefaultRunnersConfig.ignoreSystemProxy` and `askBeforeCommands` reach
  every adapter. `agent-detection.ts` checks the local LLM with
  `localFetch`. Test: both values reach the adapters.
- [ ] 4.4 `packages/core/src/harness-step-agent.ts`:
  `HARNESS_AGENT_CAPABILITIES[*].systemProxy` for every registry id, and
  a finding in `harness-config-findings.ts` naming the agents that do not
  honour the switch when it is on. Test: an explicit value for every
  registry id.
- [ ] 4.5 `packages/extension/package.json` and `extension.ts`: the
  settings `openspec-ui.agents.ignoreSystemProxy` and
  `openspec-ui.localLlm.agent.askBeforeCommands`, read where the local LLM
  settings are read and passed to `buildDefaultAgentRunners`. Test in
  `extension.test.ts` or `commands.test.ts`.
- [ ] 4.6 `packages/server` and `packages/cli`: the same two from
  `OPENSPEC_UI_IGNORE_SYSTEM_PROXY` and
  `OPENSPEC_UI_LOCAL_LLM_ASK_BEFORE_COMMANDS`. Test in each package.

## 5. Documents

- [ ] 5.1 `HARNESS.md`: the local agent's row (in process, its tools, the
  model order, asking before commands), the proxy switch with each
  agent's `systemProxy`, and "The local LLM" section updated.
- [ ] 5.2 `LIMITS.md`: the `LOCAL_LLM_ACP_*` limits as the in-process
  loop's.
- [ ] 5.3 `README.md`: the agent table's row for `local-llm-acp` says it
  needs nothing installed.
- [ ] 5.4 A changeset: core, webui, the server, the CLI and the extension,
  minor.

## 6. Checks

- [ ] 6.1 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, unpiped, exit code 0.
- [ ] 6.2 `openspec validate local-llm-codes-in-process --strict`, and the
  merge gate locally with `--base origin/main`.
- [ ] 6.3 **Delegated to local-llm-acp**: an `implement` run through
  `buildDefaultAgentRunners(...).get("local-llm-acp")`, with no model
  named anywhere and `ignoreSystemProxy` on while `HTTPS_PROXY` points at
  the system proxy, against SGLang on the LAN, on a scratch change with
  open tasks. Record the run id, the model and its source from the first
  update, the tool calls, the files written, the change's checks, and
  that `coding-agent` is not on the PATH.
- [ ] 6.4 **Human-only**: in the Extension Development Host built from
  this branch, with `openspec-ui.agents.ignoreSystemProxy` on and the
  model left empty, run one stage on `local-llm-acp` from the picker: the
  run edits files and its updates are shown. Then turn
  `openspec-ui.localLlm.agent.askBeforeCommands` on and see a command
  wait for Allow.
