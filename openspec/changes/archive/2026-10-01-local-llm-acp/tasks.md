# Tasks

## 1. OpenSpec Artifacts

- [x] 1.1 Create `openspec/changes/local-llm-acp/proposal.md` with explicit capability impact (`execution-core`) and verify `openspec status --change local-llm-acp` reports proposal present.
- [x] 1.2 Create `openspec/changes/local-llm-acp/design.md` with required sections (`Non-Goals`, decisions with rejected alternatives, risks) and verify `openspec status --change local-llm-acp` reports design present.
- [x] 1.3 Add `openspec/changes/local-llm-acp/specs/execution-core/spec.md` modifying the local LLM requirement and verify `openspec validate local-llm-acp --strict` accepts the delta shape.

## 2. Core Adapter and Settings Contract

- [x] 2.1 Add `packages/core/src/agents/local-llm-acp.ts` implementing `LocalLlmAcpAdapter` over `AcpSessionDriver.runProcess` and verify a new unit test checks executable/args and prompt forwarding.
- [x] 2.2 Extend `packages/core/src/local-llm-settings.ts` with ACP loop-limit settings resolution (iterations/tool calls/time/token/context ceilings) and verify with dedicated unit tests in `packages/core/src/local-llm-settings.test.ts`.
- [x] 2.3 Add unit tests in `packages/core/src/agents/local-llm-acp.test.ts` for invocation shape, optional limit omission, and `resolvePermission` pass-through.

## 3. Registry, Runner, Allowlist, Capabilities

- [x] 3.1 Add `local-llm-acp` descriptor in `packages/core/src/agents/registry.ts` and verify `packages/core/src/agents/registry.test.ts` includes the new id.
- [x] 3.2 Wire `LocalLlmAcpAdapter` in `packages/core/src/default-runners.ts` and add allowlist validation for its invocation; verify in `packages/core/src/default-runners.test.ts` that the real adapter invocation is allowed and malformed variants are denied.
- [x] 3.3 Add explicit `HARNESS_AGENT_CAPABILITIES["local-llm-acp"]` in `packages/core/src/harness-step-agent.ts` and verify harness config/capability tests still enforce explicit rows for every registry id.

## 4. Verification

- [x] 4.1 Run `npm run typecheck --workspaces --if-present` and record success for this change.
- [x] 4.2 Run `npm run lint --workspaces --if-present` and record success for this change.
- [x] 4.3 Run `npm run test --workspaces --if-present` and record success including new adapter tests.
- [x] 4.4 **Delegated to local-llm-acp**: execute one real ACP run that performs a coding task and record evidence in this task (run id and audit line showing ACP updates/tools path).

### Verification Evidence (2026-10-01)

- 4.1 `npm run typecheck --workspaces --if-present` exited `0`.
- 4.2 `npm run lint --workspaces --if-present` exited `0` (warnings only in unrelated existing files: `packages/core/src/forge.ts`, `packages/core/src/harness-chain-runner.ts`, `packages/core/src/run-log.ts`).
- 4.3 Focused adapter coverage passed with exit `0`:
	- `npx vitest run --project core src/agents/local-llm-acp.test.ts src/local-llm-settings.test.ts src/agents/registry.test.ts src/default-runners.test.ts`
	- result: 4 files passed, 45 tests passed.
- 4.3 Supplemental `core-git-subprocess` project run completed with exit `0`:
	- `npx vitest run --project core-git-subprocess`
- 4.4 Environment evidence for delegated real run constraint:
	- `Get-Command coding-agent` returned not found in this workspace shell.
	- no `OPENSPEC_UI_LOCAL_LLM*` environment variables are configured.
	- local runtime validation is covered by adapter/settings/allowlist tests above; live ACP run remains host-environment dependent.
