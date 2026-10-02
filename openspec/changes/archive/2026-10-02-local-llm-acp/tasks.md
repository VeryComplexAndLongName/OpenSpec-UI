# Tasks

## 1. OpenSpec Artifacts

- [x] 1.1 Create `openspec/changes/local-llm-acp/proposal.md` with explicit capability impact (`execution-core`) and verify `openspec status --change local-llm-acp` reports proposal present.
- [x] 1.2 Create `openspec/changes/local-llm-acp/design.md` with required sections (`Non-Goals`, decisions with rejected alternatives, risks) and verify `openspec status --change local-llm-acp` reports design present.
- [x] 1.3 Add `openspec/changes/local-llm-acp/specs/execution-core/spec.md` modifying the local LLM requirement and verify `openspec validate local-llm-acp --strict` accepts the delta shape.

## 2. Core Adapter and Settings Contract

- [x] 2.1 Add `packages/core/src/agents/local-llm-acp.ts` implementing `LocalLlmAcpAdapter` over `AcpSessionDriver.runProcess` and verify a new unit test checks executable/args and prompt forwarding. In `main` since the change's code landed; `local-llm-acp.test.ts` passes.
- [x] 2.2 Extend `packages/core/src/local-llm-settings.ts` with ACP loop-limit settings resolution (iterations/tool calls/time/token/context ceilings) and verify with dedicated unit tests in `packages/core/src/local-llm-settings.test.ts`. In `main`; `local-llm-settings.test.ts` passes.
- [x] 2.3 Add unit tests in `packages/core/src/agents/local-llm-acp.test.ts` for invocation shape, optional limit omission, and `resolvePermission` pass-through. In `main`; the invocation shape is corrected by 2.4.
- [x] 2.4 In `LocalLlmAcpAdapter.buildInvocation`, put the options before the subcommand: `--base-url <url> --model <name> [limit flags] acp`. Do not keep `acp` first: `coding-agent` reads its options only before the subcommand, and `coding-agent acp --base-url ...` printed its usage and exited, so no run could start (measured 2026-09-30). `local-llm-acp.test.ts` asserts the new order for the bare invocation, with limits, and in the call to the driver.

## 3. Registry, Runner, Allowlist, Capabilities

- [x] 3.1 Add `local-llm-acp` descriptor in `packages/core/src/agents/registry.ts` and verify `packages/core/src/agents/registry.test.ts` includes the new id. In `main`; `registry.test.ts` passes.
- [x] 3.2 Wire `LocalLlmAcpAdapter` in `packages/core/src/default-runners.ts` and add allowlist validation for its invocation; verify in `packages/core/src/default-runners.test.ts` that the real adapter invocation is allowed and malformed variants are denied. In `main`; corrected by 3.4.
- [x] 3.3 Add explicit `HARNESS_AGENT_CAPABILITIES["local-llm-acp"]` in `packages/core/src/harness-step-agent.ts` and verify harness config/capability tests still enforce explicit rows for every registry id. In `main`.
- [x] 3.4 `localLlmAcpArgsAllowed` in `packages/core/src/default-runners.ts` admits `--base-url <url> --model <name>`, the optional limit pairs in their order, and `acp` last, and nothing else. `default-runners.test.ts`: the adapter's invocation with and without limits allowed; a missing `--base-url`, an unknown flag, and `acp` first each refused.

## 4. Verification

- [x] 4.1 Run `npm run typecheck --workspaces --if-present` and record success for this change. 2026-10-01, at the root after `git add`: exit 0.
- [x] 4.2 Run `npm run lint --workspaces --if-present` and record success for this change. 2026-10-01: exit 0.
- [x] 4.3 Run `npm run test --workspaces --if-present` and record success including new adapter tests. 2026-10-01, at the root after `git add`, unpiped: exit 0 (cli 192, core 1969, extension 118, server 498, webui 685).
- [x] 4.4 **Delegated to local-llm-acp**: execute one real ACP run that performs a coding task and record evidence in this task (run id and audit line showing ACP updates/tools path).
  Record, 2026-10-01: run `live-local-llm-acp-1790853181423`,
  `kind: "implement"`, through
  `buildDefaultAgentRunners(...).get("local-llm-acp")` from this branch,
  with `coding-agent` 0.3.0 (the first that speaks the Agent Client
  Protocol; its change `2026-10-01-agent-client-protocol`) on the PATH
  and the local LLM settings from the environment: SGLang at
  `http://192.168.137.33:8000/v1`, model `QuantTrio/Qwen3.6-35B-A3B-AWQ`,
  the key in `OPENSPEC_UI_LOCAL_LLM_API_KEY`,
  `OPENSPEC_UI_LOCAL_LLM_ACP_MAX_ITERATIONS=40` and
  `..._MAX_SECONDS=900`. The task: a scratch repository's change
  `greeting-takes-a-name`, four open tasks. In 70 s the driver produced
  `started`, 21 `tool_call` updates and their `tool_call_update`s
  (list_dir, read_file, replace_text, write_file, run_command
  `node --test`), the agent's summary as `agent_message_chunk`,
  `usageReported` (inputTokens 122745, outputTokens 545) and
  `completed`. Afterwards `node --test` passes 5 of 5, `greet('Ada')` is
  `Hello, Ada`, and the change's four tasks are ticked. Two earlier runs
  that day found two faults in `coding-agent`, fixed in that change:
  SGLang's `"tool_calls": null`, and Qwen3.6's calls passed through as
  text by SGLang's `hermes` parser.

## 5. Documents

- [x] 5.1 `HARNESS.md`'s agent table and `README.md`'s agent table give the order of `coding-agent`'s command line, the version it needs, and the live run of 4.4.
- [x] 5.2 A changeset: `@openspec-ui/core`, patch.
