# Tasks

## 1. OpenSpec Artifacts

- [x] 1.1 Create `openspec/changes/local-llm-acp/proposal.md` with explicit capability impact (`execution-core`) and verify `openspec status --change local-llm-acp` reports proposal present.
- [x] 1.2 Create `openspec/changes/local-llm-acp/design.md` with required sections (`Non-Goals`, decisions with rejected alternatives, risks) and verify `openspec status --change local-llm-acp` reports design present.
- [x] 1.3 Add `openspec/changes/local-llm-acp/specs/execution-core/spec.md` modifying the local LLM requirement and verify `openspec validate local-llm-acp --strict` accepts the delta shape.

## 2. Core Adapter and Settings Contract

- [ ] 2.1 Add `packages/core/src/agents/local-llm-acp.ts` implementing `LocalLlmAcpAdapter` over `AcpSessionDriver.runProcess` and verify a new unit test checks executable/args and prompt forwarding.
- [ ] 2.2 Extend `packages/core/src/local-llm-settings.ts` with ACP loop-limit settings resolution (iterations/tool calls/time/token/context ceilings) and verify with dedicated unit tests in `packages/core/src/local-llm-settings.test.ts`.
- [ ] 2.3 Add unit tests in `packages/core/src/agents/local-llm-acp.test.ts` for invocation shape, optional limit omission, and `resolvePermission` pass-through.

## 3. Registry, Runner, Allowlist, Capabilities

- [ ] 3.1 Add `local-llm-acp` descriptor in `packages/core/src/agents/registry.ts` and verify `packages/core/src/agents/registry.test.ts` includes the new id.
- [ ] 3.2 Wire `LocalLlmAcpAdapter` in `packages/core/src/default-runners.ts` and add allowlist validation for its invocation; verify in `packages/core/src/default-runners.test.ts` that the real adapter invocation is allowed and malformed variants are denied.
- [ ] 3.3 Add explicit `HARNESS_AGENT_CAPABILITIES["local-llm-acp"]` in `packages/core/src/harness-step-agent.ts` and verify harness config/capability tests still enforce explicit rows for every registry id.

## 4. Verification

- [ ] 4.1 Run `npm run typecheck --workspaces --if-present` and record success for this change.
- [ ] 4.2 Run `npm run lint --workspaces --if-present` and record success for this change.
- [ ] 4.3 Run `npm run test --workspaces --if-present` and record success including new adapter tests.
- [ ] 4.4 **Delegated to local-llm-acp**: execute one real ACP run that performs a coding task and record evidence in this task (run id and audit line showing ACP updates/tools path).
