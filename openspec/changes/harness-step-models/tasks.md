Mark each task `[x]` as soon as its own check passes — not in one batch
at the end, and never before the work is actually done.

## 1. Registry capability

- [ ] 1.1 `packages/core/src/agents/registry.ts`: add an optional
  `modelFlag?: string` field to `AgentDescriptor`, documented as "the CLI
  flag this adapter passes a model with; absent means this adapter
  accepts no model".
- [ ] 1.2 `packages/core/src/agents/registry.ts`: set `modelFlag:
  "--model"` on the `claude-cli` and `copilot-cli` entries only. Do
  **not** set it on `codex-cli`, `gemini-cli` or `local-llm` — their
  support is unverified or out of scope (see design.md Non-Goals).

## 2. Config schema and validation

- [ ] 2.1 `packages/core/src/harness-config.ts`: change
  `HarnessStepAgents` to `Partial<Record<HarnessStage, string | {
  agent: string; model?: string }>>`.
- [ ] 2.2 `packages/core/src/harness-config.ts`: add an exported helper
  `normalizeStepAgent(entry)` returning `{ agent: string; model?: string
  }` for either form. Every consumer uses it; do not spread the
  both-shapes handling across call sites.
- [ ] 2.3 `packages/core/src/harness-config.ts`: add a module-level
  `MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/` with a comment
  stating it is an allow-list of characters so a value cannot become a
  second flag (see design.md).
- [ ] 2.4 `packages/core/src/harness-config.ts`, `assertValidStepAgents`
  (line ~91): accept the object form; keep every existing error message
  for the string form byte-identical.
- [ ] 2.5 `packages/core/src/harness-config.ts`, `assertValidStepAgents`:
  reject a `model` that fails `MODEL_ID_PATTERN`, with a message naming
  the stage.
- [ ] 2.6 `packages/core/src/harness-config.ts`, `assertValidStepAgents`:
  reject a `model` set for an agent whose `AGENT_REGISTRY` descriptor has
  no `modelFlag`, with a message naming the stage and the agent id.

## 3. Consumers

- [ ] 3.1 `packages/core/src/harness-chain-runner.ts` line ~284
  (`nextAgentId`): use `normalizeStepAgent(...).agent`. Behavior
  unchanged.
- [ ] 3.2 `packages/core/src/harness-chain-runner.ts` line ~327
  (`const agentId = ...`): use `normalizeStepAgent(...)` and carry the
  resolved model through to the command it builds.
- [ ] 3.3 `packages/extension/src/commands.ts` line ~169 (`stepAgents[
  stage] = agent.id`): keep writing the string form — this wizard does
  not ask about models, and writing the object form would change files it
  did not need to change.

## 4. Adapters

- [ ] 4.1 `packages/core/src/agents/claude.ts`: when a model is resolved
  for the run, append `--model <model>` to `buildInvocation()`'s args,
  positionally last. When no model is resolved, args are byte-identical
  to today.
- [ ] 4.2 `packages/core/src/agents/copilot.ts`: same, positionally last,
  after `--allow-all-tools`. Leave the prompt-length fallback logic
  untouched.

## 5. Allowlist

- [ ] 5.1 `packages/core/src/default-runners.ts`: add a matcher
  `exactWithOptionalModel(expected, modelFlag)` that accepts `expected`
  exactly, or `expected` followed by exactly two more elements: the
  `modelFlag` and one value matching `MODEL_ID_PATTERN`. Nothing else.
- [ ] 5.2 `packages/core/src/default-runners.ts`: use it for `claude-cli`
  and `copilot-cli` only; `codex-cli`, `gemini-cli` and `local-llm` keep
  their current `exact(...)`/predicate unchanged.

## 6. Tests

- [ ] 6.1 `harness-config.test.ts`: the string form still resolves
  exactly as before (regression guard for task 2.4).
- [ ] 6.2 `harness-config.test.ts`: the object form resolves to the same
  agent, with the model carried.
- [ ] 6.3 `harness-config.test.ts`: a model containing a space, a quote,
  or a leading `-` is rejected at config read, one case each.
- [ ] 6.4 `harness-config.test.ts`: a model set for `local-llm` (no
  `modelFlag`) is rejected, and the error names the stage and agent.
- [ ] 6.5 `harness-config.test.ts`: a per-change `harness.json` model
  overrides the global one for that stage.
- [ ] 6.6 `claude.test.ts`: `buildInvocation()` args are byte-identical
  to today when no model is set, and gain a trailing `--model <value>`
  when one is.
- [ ] 6.7 `copilot.test.ts`: same as 6.6, with the model after
  `--allow-all-tools`.
- [ ] 6.8 `default-runners.test.ts`: `checkAllowlist` allows the model
  form for `claude-cli`, and rejects an argv carrying a second `--model`,
  a `--model` with no value, or a value failing the pattern — one case
  each.

## 7. Verification

- [ ] 7.1 `openspec change validate --strict harness-step-models`.
- [ ] 7.2 `npm run typecheck --workspace @openspec-ui/core` and
  `npm run lint --workspace @openspec-ui/core` — both clean.
- [ ] 7.3 `npm run test --workspace @openspec-ui/core` — green. Note:
  `sprint-report.test.ts` has two pre-existing Windows `EBUSY` failures
  unrelated to this change; do not attempt to fix them here.
- [ ] 7.4 `npm run typecheck --workspace openspec-ui-vscode` and
  `npm run test --workspace openspec-ui-vscode` — green (task 3.3 touches
  this package).
- [ ] 7.5 `openspec/specs/agentic-harness/spec.md` and
  `openspec/specs/execution-core/spec.md` deltas are already written in
  this change's `specs/` directory — confirm they match what was
  implemented; do not rewrite them.
- [ ] 7.6 Version bump via `npx changeset` (`@openspec-ui/core`, minor —
  a new capability in the config schema, backward compatible).
- [ ] 7.7 `docs/adr/README.md`: add the ADR 0015 row to the index.
  **Do this only once the concurrent uncommitted edits to that file (ADR
  0013/0014 rows) have been committed** — otherwise committing this file
  would sweep up another session's work.
- [ ] 7.8 **Human-only, cannot be completed by an implementing agent**:
  live smoke test — set `apply` to a cheaper model in
  `openspec/agent-harness.json`, run a real harness `implement`, and
  confirm from the run's own output that the cheaper model was used.
  Leave unchecked if you are an agent; report it as outstanding.
