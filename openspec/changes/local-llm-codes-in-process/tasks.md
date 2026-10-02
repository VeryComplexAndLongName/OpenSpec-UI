Requested by the owner on 2026-10-02: the local model's coding agent
lives in the product (ADR 0038), its model is optional, and agents can
ignore the system proxy. Blocked by `local-llm-acp`.

## 1. The decision

- [x] 1.1 **Human-only**: the owner accepts ADR 0038 and this proposal;
  `docs/adr/0038-the-local-model-codes-in-the-product.md` then reads
  `Status: Accepted`, and `docs/adr/README.md`'s row says so. The owner
  answered "go ahead" on 2026-10-02 to the proposal pushed as
  `8ed05ab8`, which asked whether anything should change before
  implementation; the ADR and its row now read Accepted.

## 2. The in-process agent

- [x] 2.1 `packages/core/src/agents/local-agent/text-tool-calls.ts`:
  `toolCallsInText(content, parameterTypes)`, ported from
  `coding-agent`'s `tool_calls_in_text`. Test in `text-tool-calls.test.ts`:
  a Qwen3-Coder call, a Hermes call, JSON-looking file content kept as
  text, a tool not offered left as text, several calls numbered. 5 passed.
- [x] 2.2 `packages/core/src/agents/local-agent/sandbox.ts`:
  `resolveInside(cwd, path)` by real path, the nearest existing ancestor's
  real path for a file not yet written. Test in `sandbox.test.ts`: `..`,
  an absolute path elsewhere, a link pointing outside (a junction on
  Windows), and paths inside, each answered. 4 passed. Do not resolve with
  `path.resolve` alone: a link inside `cwd` can point outside it.
- [x] 2.3 `packages/core/src/agents/local-agent/tools.ts`: `read_file`,
  `write_file`, `replace_text`, `list_dir`, `search_text`, `run_command`,
  with their JSON schemas. `run_command` runs through the shell in `cwd`
  and ends a command at `commandTimeoutSeconds` through
  `terminateProcessTree`. Test in `tools.test.ts`: each tool, the output
  cap, the time limit (a 60 s command ended at 1 s), a refused path, an
  unknown tool and a missing argument. 7 passed.
- [x] 2.4 `packages/core/src/agents/local-agent/chat-client.ts`: one
  `/v1/chat/completions` request with tools, reading `tool_calls`,
  `"tool_calls": null`, `"usage": null` and null arguments as none, then
  `toolCallsInText`. Test in `chat-client.test.ts` against a local HTTP
  stand-in. 3 passed.
- [x] 2.5 `packages/core/src/agents/local-agent/agent-loop.ts`: the loop
  bounded by `LocalLlmAcpLimits`, giving progress events (text, tool call,
  tool result, usage) and a stop reason. Test in `agent-loop.test.ts`: a
  turn that writes a file, the iteration limit, the tool-call limit, a
  token limit. 4 passed.
- [x] 2.6 `packages/core/src/agents/local-agent/acp-agent.ts`: an
  `AgentApp` serving `initialize`, `session/new` (the session's `cwd`),
  `session/prompt` (updates `agent_message_chunk`, `tool_call`,
  `tool_call_update`; response `stopReason` and `usage`) and
  `session/cancel`; the run's abort signal ends the loop and kills a
  running command. With `askBeforeCommands`, `run_command` sends
  `session/request_permission`. Tested in `local-llm-acp.test.ts` through
  `AcpSessionDriver.run()`, not around it: the events a run produces, the
  model named in the first update, a call written as text, a refused path,
  a permission allowed and one denied, the iteration limit. 8 passed.
- [x] 2.7 `packages/core/src/agents/local-llm-acp.ts`:
  `LocalLlmAcpAdapter.buildInvocation` returns
  `{ kind: "in-process", agent: "local-llm-acp" }`, and `execute` runs the
  agent of 2.6 through `driver.run`. No process is started.
  `local-llm-acp.test.ts` asserts it.
- [x] 2.8 `packages/core/src/agent-runner.ts` and `security.ts`:
  `AdapterInvocation` gains `in-process`. `checkAllowlist` admits it only
  through an `IN_PROCESS_SENTINEL` rule naming the agent itself, and the
  audit records the invocation as it records any other. Tested in
  `default-runners.test.ts` ("admits local-llm-acp only as itself"): in
  process accepted for `local-llm-acp`, refused when it names another
  agent, refused for `claude-cli`, and a `coding-agent` process refused.
- [x] 2.9 `packages/core/src/default-runners.ts`: the `coding-agent`
  allowlist entry and `LOCAL_LLM_ACP_DEFAULT_EXECUTABLE` removed;
  `default-runners.test.ts` updated. Agent detection
  (`agent-detection.ts`) reports `local-llm-acp` present where the local
  LLM's server answers, as it does `local-llm`.

## 3. The model

- [x] 3.1 `packages/core/src/agents/registry.ts`:
  `AgentDescriptor.takesModel` and `acceptsModel(descriptor)`, true where
  `modelFlag` is set and for `local-llm` and `local-llm-acp`.
- [x] 3.2 `packages/core/src/harness-config.ts` and
  `harness-config-schema.ts` decide acceptance by `acceptsModel`, not
  `modelFlag`. `MODEL_ID_PATTERN` admits `/`, since a local server names
  models as Hugging Face does. `harness-config.test.ts`: a model with a
  slash accepted for both local agents, still refused for `gemini-cli`.
- [x] 3.3 `packages/core/src/local-llm-settings.ts`:
  `resolveLocalLlmModel(stageModel, settings, fetch)` (stage, then
  settings, then `/v1/models` cached per base URL, then `default`),
  returning the name and its source; `resolveLocalLlmSettings` no longer
  defaults the model. `local-llm-settings.test.ts`: each source, the first
  of several served, one request per server, an unreachable server asked
  again next time. 17 passed.
- [x] 3.4 `packages/core/src/agents/local-llm.ts` and the agent of 2.6 use
  3.3, and the first output of a run names the model and its source
  (`local-llm.test.ts`, `local-llm-acp.test.ts`).
- [x] 3.5 `packages/webui/src/components/harness-settings-parts.tsx`
  offers the model field to agents with `takesModel`. Test in
  `harness-settings-parts.test.tsx`: both local agents, `claude-cli` yes,
  `gemini-cli` no.
- [x] 3.6 `packages/extension/schemas/agent-harness.schema.json` and
  `change-harness.schema.json`, regenerated with
  `npm run schemas --workspace packages/extension`, accept a model for
  both local agents.

## 4. The system proxy

- [x] 4.1 `packages/core/src/direct-fetch.ts`: `localFetch(ignoreSystemProxy)`
  returns `undici`'s `fetch` with an `Agent` of its own when asked, and the
  process's `fetch` otherwise. `undici` 7 (Node 20.18+, within the pinned
  22.11; 8 needs 22.19). Test in `direct-fetch.test.ts`: with a dead proxy
  installed as the process's global dispatcher, as an editor host can, the
  process's `fetch` fails and `localFetch(true)` reaches the server.
- [x] 4.2 `packages/core/src/agents/shared.ts` and
  `acp-session-driver.ts`: `agentSpawnEnvironment` gives a CLI agent an
  environment without `HTTP_PROXY`, `HTTPS_PROXY` and `ALL_PROXY` in either
  case and with `NO_PROXY=*` (`withoutSystemProxy`), in `spawnAndStream`
  and `spawnAcpProcess`. Test in `proxy-policy.test.ts`: the variables
  removed, and the environment that reaches the spawn.
- [x] 4.3 `packages/core/src/default-runners.ts`:
  `DefaultRunnersConfig.ignoreSystemProxy` and `askBeforeCommands` reach
  the adapters and the CLI spawn policy, and `agent-detection.ts` checks
  the local LLM with `localFetch` under the same policy. Test in
  `proxy-policy.test.ts`.
- [x] 4.4 `packages/core/src/harness-step-agent.ts`:
  `HARNESS_AGENT_CAPABILITIES[*].systemProxy` for every registry id and
  `vscode-chat` (`ignored`, `environment` or `unknown`), shown as the table
  in `HARNESS.md`, "Ignoring the system proxy". No configuration finding:
  the switch is the host's, not the harness file's, so
  `findHarnessConfigLimits`, which reads only the harness file, cannot see
  it.
- [x] 4.5 `packages/extension/package.json` and `extension.ts`: the
  settings `openspec-ui.agents.ignoreSystemProxy` and
  `openspec-ui.localLlm.agent.askBeforeCommands`, read by
  `readAgentSwitches()` and passed to `buildDefaultAgentRunners`, and to
  the optional local server's runners (`optional-server.ts`), so the two
  agree.
- [x] 4.6 `packages/server` and `packages/cli`: no code of their own.
  `buildDefaultAgentRunners` reads `OPENSPEC_UI_IGNORE_SYSTEM_PROXY` and
  `OPENSPEC_UI_LOCAL_LLM_ASK_BEFORE_COMMANDS` where a host passes neither,
  which both do. Test in `proxy-policy.test.ts`: the environment variable
  applies where the host says nothing, and a host's own value wins.

## 5. Documents

- [x] 5.1 `HARNESS.md`: the two local agents' rows (the model optional,
  `local-llm-acp` built in), "The local LLM" (the model order, the agent's
  tools and sandbox, asking before commands, calls written as text), and a
  new "Ignoring the system proxy" with each agent's `systemProxy`.
- [x] 5.2 `LIMITS.md`: the `LOCAL_LLM_ACP_*` limits as the in-process
  loop's, with their defaults and the context limits that act on nothing;
  `local-llm-acp` in the usage and context-gauge tables.
- [x] 5.3 `README.md`: the agent table's row for `local-llm-acp` says it
  needs nothing installed.
- [x] 5.4 A changeset: core, webui, the server, the CLI and the extension,
  minor.

## 6. Checks

- [x] 6.1 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, unpiped, exit code 0. 2026-10-02: typecheck 0, lint 0,
  test 0; the script tests fail 0, and the workspaces 21/192, 143/2010
  (core), 7/62, 36/498, 4/118, 76/687 files/tests passed.
- [x] 6.2 `openspec validate local-llm-codes-in-process --strict`, and the
  merge gate locally with `--base origin/main`. 2026-10-02: "Change
  'local-llm-codes-in-process' is valid", exit 0. The gate, run with the
  worktree's absolute path as `--cwd` (`--cwd .` resolves against
  `packages/cli` under `npm run --workspace`, and checked nothing), owes
  only 6.4, the Human-only item; it passes once 6.4 is closed.
- [x] 6.3 **Delegated to local-llm-acp**: an `implement` run through
  `buildDefaultAgentRunners(...).get("local-llm-acp")`, with no model
  named anywhere and `ignoreSystemProxy` on while `HTTPS_PROXY` points at
  the system proxy, against SGLang on the LAN, on a scratch change with
  open tasks. Record the run id, the model and its source from the first
  update, the tool calls, the files written, the change's checks, and
  that `coding-agent` is not on the PATH.
  Record, 2026-10-02: run `live-in-process-1790906039976`, from this
  branch's `packages/core`, with `HTTP_PROXY` and `HTTPS_PROXY` set to the
  system proxy `http://127.0.0.1:2080` (which resets requests to the LAN),
  `NO_PROXY` without the server's address, `OPENSPEC_UI_LOCAL_LLM_MODEL`
  unset, the base URL `http://192.168.137.33:8000/v1` and the key from the
  environment, and `coding-agent` not on the PATH. First update: "Model
  QuantTrio/Qwen3.6-35B-A3B-AWQ (the model the server serves)." 56 s from
  `started` to `completed`; 24 tool calls streamed with their results
  (list_dir, read_file, replace_text, write_file, run_command), one of
  them a `read_file` of a wrong path that failed and was retried;
  `usageReported` inputTokens 72100, outputTokens 4101. The scratch change
  `farewell-takes-a-name`: `src/farewell.mjs` now takes a name, falling
  back to "Goodbye, world" for none or a blank one; `src/farewell.test.mjs`
  added; `node --test src/farewell.test.mjs` passes 4 of 4; both tasks
  ticked; `git status` shows only those two files and the change's
  `tasks.md`. Task 1.2's own command, `node --test src/`, does not run on
  Node 24 with a directory argument; the agent found that, tried other
  forms and verified with the file. The task's wording was at fault, not
  the agent.
- [ ] 6.4 **Human-only**: in the Extension Development Host built from
  this branch, with `openspec-ui.agents.ignoreSystemProxy` on and the
  model left empty, run one stage on `local-llm-acp` from the picker: the
  run edits files and its updates are shown. Then turn
  `openspec-ui.localLlm.agent.askBeforeCommands` on and see a command
  wait for Allow.
- [x] 6.5 Found while attempting 6.4: every run that failed inside an ACP
  connection (any ACP agent, not only `local-llm-acp` — the shared
  `AcpSessionDriver`) reported only "Internal error", whatever actually
  failed. The Agent Client Protocol SDK wraps any handler exception into
  a `RequestError` whose `message` is the fixed string "Internal error"
  (JSON-RPC code -32603), keeping the real cause only in `data.details`.
  `packages/core/src/agents/acp-session-driver.ts`'s `connectionFailureReason`
  reads `data.details` where present. Reproduced before the fix with a
  direct call to `LocalLlmAcpAdapter.execute` against the real LAN server
  with a wrong key: `reason` was `"Internal error"`; after the fix, the
  same call reports `reason: "HTTP 401 Unauthorized: {\"error\":\"Unauthorized\"}"`.
  Test in `acp-session-driver.test.ts`: a handler that throws reports its
  own message, not "Internal error". `npm run typecheck && npm run lint
  && npm run test` at the root, unpiped: exit 0 (core 18/18 new+existing
  in the two directly affected files; server 118/118; webui 687/687; no
  new failures anywhere).
