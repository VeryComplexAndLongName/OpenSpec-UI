Mark each task `[x]` as soon as its own check passes — not in one batch
at the end, and never before the work is actually done.

## 1. Registry capability

- [x] 1.1 `packages/core/src/agents/registry.ts`: add an optional
  `modelFlag?: string` field to `AgentDescriptor`, documented as "the CLI
  flag this adapter passes a model with; absent means this adapter
  accepts no model".
- [x] 1.2 `packages/core/src/agents/registry.ts`: set `modelFlag:
  "--model"` on the `claude-cli` and `copilot-cli` entries only. Do
  **not** set it on `codex-cli`, `gemini-cli` or `local-llm` — their
  support is unverified or out of scope (see design.md Non-Goals).

## 2. Config schema and validation

- [x] 2.1 `packages/core/src/harness-config.ts`: change
  `HarnessStepAgents` to `Partial<Record<HarnessStage, string | {
  agent: string; model?: string }>>`.
- [x] 2.2 `packages/core/src/harness-config.ts`: add an exported helper
  `normalizeStepAgent(entry)` returning `{ agent: string; model?: string
  }` for either form. Every consumer uses it; do not spread the
  both-shapes handling across call sites.
- [x] 2.3 `packages/core/src/harness-config.ts`: add a module-level
  `MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/` with a comment
  stating it is an allow-list of characters so a value cannot become a
  second flag (see design.md).
- [x] 2.4 `packages/core/src/harness-config.ts`, `assertValidStepAgents`
  (line ~91): accept the object form; keep every existing error message
  for the string form byte-identical.
- [x] 2.5 `packages/core/src/harness-config.ts`, `assertValidStepAgents`:
  reject a `model` that fails `MODEL_ID_PATTERN`, with a message naming
  the stage.
- [x] 2.6 `packages/core/src/harness-config.ts`, `assertValidStepAgents`:
  reject a `model` set for an agent whose `AGENT_REGISTRY` descriptor has
  no `modelFlag`, with a message naming the stage and the agent id.

## 3. Consumers

- [x] 3.1 `packages/core/src/harness-chain-runner.ts` line ~284
  (`nextAgentId`): use `normalizeStepAgent(...).agent`. Behavior
  unchanged.
- [x] 3.2 `packages/core/src/harness-chain-runner.ts` line ~327
  (`const agentId = ...`): use `normalizeStepAgent(...)` and carry the
  resolved model through to the command it builds.
- [x] 3.3 `packages/extension/src/commands.ts` line ~169 (`stepAgents[
  stage] = agent.id`): keep writing the string form — this wizard does
  not ask about models, and writing the object form would change files it
  did not need to change.

## 4. Adapters

- [x] 4.1 `packages/core/src/agents/claude.ts`: when a model is resolved
  for the run, append `--model <model>` to `buildInvocation()`'s args,
  positionally last. When no model is resolved, args are byte-identical
  to today.
- [x] 4.2 `packages/core/src/agents/copilot.ts`: same, positionally last,
  after `--allow-all-tools`. Leave the prompt-length fallback logic
  untouched.

## 5. Allowlist

- [x] 5.1 `packages/core/src/default-runners.ts`: add a matcher
  `exactWithOptionalModel(expected, modelFlag)` that accepts `expected`
  exactly, or `expected` followed by exactly two more elements: the
  `modelFlag` and one value matching `MODEL_ID_PATTERN`. Nothing else.
- [x] 5.2 `packages/core/src/default-runners.ts`: use it for `claude-cli`
  and `copilot-cli` only; `codex-cli`, `gemini-cli` and `local-llm` keep
  their current `exact(...)`/predicate unchanged.

## 6. Tests

- [x] 6.1 `harness-config.test.ts`: the string form still resolves
  exactly as before (regression guard for task 2.4).
- [x] 6.2 `harness-config.test.ts`: the object form resolves to the same
  agent, with the model carried.
- [x] 6.3 `harness-config.test.ts`: a model containing a space, a quote,
  or a leading `-` is rejected at config read, one case each.
- [x] 6.4 `harness-config.test.ts`: a model set for `local-llm` (no
  `modelFlag`) is rejected, and the error names the stage and agent.
- [x] 6.5 `harness-config.test.ts`: a per-change `harness.json` model
  overrides the global one for that stage.
- [x] 6.6 `claude.test.ts`: `buildInvocation()` args are byte-identical
  to today when no model is set, and gain a trailing `--model <value>`
  when one is.
- [x] 6.7 `copilot.test.ts`: same as 6.6, with the model after
  `--allow-all-tools`.
- [x] 6.8 `default-runners.test.ts`: `checkAllowlist` allows the model
  form for `claude-cli`, and rejects an argv carrying a second `--model`,
  a `--model` with no value, or a value failing the pattern — one case
  each.

## 7. Verification

- [x] 7.1 `openspec change validate --strict harness-step-models`.
- [x] 7.2 `npm run typecheck --workspace @openspec-ui/core` and
  `npm run lint --workspace @openspec-ui/core` — both clean.
- [x] 7.3 `npm run test --workspace @openspec-ui/core` — green. Note:
  `sprint-report.test.ts` has two pre-existing Windows `EBUSY` failures
  unrelated to this change; do not attempt to fix them here. (Also saw
  the same pre-existing EBUSY pattern in `change-timeline.test.ts`, same
  root cause — git tmp-dir cleanup on Windows, not touched by this
  change.)
- [x] 7.4 `npm run typecheck --workspace openspec-ui-vscode` and
  `npm run test --workspace openspec-ui-vscode` — green (task 3.3 touches
  this package). Also had to fix two other pre-existing consumers of the
  now-widened `stepAgents` type that were not in proposal.md's Impact
  list: `packages/extension/src/webview/ai-panel.ts` and
  `packages/webui/src/components/HarnessSettingsView.tsx` /
  `packages/webui/src/standalone-entry.tsx` (all three only ever read a
  stage's agent id for display, never a model — fixed via
  `normalizeStepAgent`, moved to its own zero-Node-import leaf module
  `harness-step-agent.ts` so it stays importable from
  `@openspec-ui/core/browser`). `npm run typecheck`/`lint`/`test` for
  `@openspec-ui/server` and `@openspec-ui/webui` also verified green,
  including `server/src/static.test.ts` (browser-bundle Node-import
  leakage check).
- [x] 7.5 `openspec/specs/agentic-harness/spec.md` and
  `openspec/specs/execution-core/spec.md` deltas are already written in
  this change's `specs/` directory — confirm they match what was
  implemented; do not rewrite them. Checked against the implementation:
  bare-string form unchanged, object form validated at read time (bad
  pattern / unsupported agent both rejected, naming the stage), per-
  change override wins (test 6.5), allowlist admits exactly one
  model flag+value pair for model-capable adapters only. Matches.
- [x] 7.6 Version bump via `npx changeset` (`@openspec-ui/core`, minor —
  a new capability in the config schema, backward compatible). Added
  `.changeset/harness-step-models.md`; `npx changeset status` confirms
  `@openspec-ui/core` minor, with `server`/`webui`/`openspec-ui-vscode`
  cascading to patch as its dependents.
- [ ] 7.7 `docs/adr/README.md`: add the ADR 0015 row to the index.
  **Do this only once the concurrent uncommitted edits to that file (ADR
  0013/0014 rows) have been committed** — otherwise committing this file
  would sweep up another session's work. Left unchecked: as of this
  session, `docs/adr/README.md` still has the ADR 0013/0014 rows
  uncommitted (working-tree diff, not yet on `main`) — the gate has not
  cleared yet. Outstanding.
- [x] 7.8 **Human-only, cannot be completed by an implementing agent**:
  live smoke test — set `apply` to a cheaper model (in
  `openspec/agent-harness.json`, or a per-change `harness.json` when the
  global file has uncommitted edits), run a real harness `implement`, and
  confirm the spawned process command line actually contains
  `--model <value>`. First rebuild and reinstall the extension
  (`npm run reinstall:local --workspace openspec-ui-vscode`, then
  "Developer: Reload Window") — otherwise the installed bundle still runs
  pre-change code and the test measures nothing. Leave unchecked if you
  are an agent; report it as outstanding.
  **Run 2026-09-01 and FAILED**: the config resolved without error, but
  the spawned process was `claude -p --output-format text
  --dangerously-skip-permissions` — no `--model`. Cause in section 8.

## 8. Assisted path (found by task 7.8's smoke test)

The smoke test showed the spawned process running as `claude -p
--output-format text --dangerously-skip-permissions` — no `--model`. The
config validated and resolved correctly; only the chain path
(`harness-chain-runner.ts`, tasks 3.1/3.2) ever attaches the model to a
`Command`. The `assisted` picker path — which is what the global config
uses, and what the smoke test exercised — builds its own `Command` and
drops it. Section 3's consumer list was incomplete.

- [x] 8.1 `packages/webui/src/components/AiPanel.tsx` (~line 845, where
  `const command: Command = {...}` is built): resolve the stage via the
  existing `COMMAND_KIND_TO_HARNESS_STAGE[kind]`, read that stage's entry
  from the existing `stepAgents` prop, and pass `model` on the command —
  but **only when `normalizeStepAgent(entry).agent === agentId`**, i.e.
  when the agent actually selected is the one the model was configured
  for. Omit `model` otherwise (see design.md, "A model belongs to its
  configured agent").
- [x] 8.2 `AiPanel.test.tsx`: a run whose selected agent matches the
  stage's configured agent sends `model` on the command.
- [x] 8.3 `AiPanel.test.tsx`: after the user picks a different agent in
  the picker than the configured one, the command carries no `model`.
- [x] 8.4 `AiPanel.test.tsx`: a command kind with no harness stage
  (`list`/`show`/`validate`) never carries a `model`.
- [x] 8.5 `npm run typecheck`/`lint`/`test --workspace @openspec-ui/webui`
  — green.
- [x] 8.6 **Human-only**: re-run task 7.8's smoke test (rebuild and
  reinstall first) and confirm the spawned process command line now
  contains `--model`. Leave unchecked if you are an agent.

Note on 8.1–8.5: the implementing agent (`claude-cli` on the cheapest
model) produced correct code and tests for all of them but marked none —
it did not touch `tasks.md` at all. They are marked here by the reviewer,
who ran each check directly (`npm run test --workspace @openspec-ui/webui`
= 204 passed, up from 201). Recorded because it is evidence about the
marking rule itself: the previous run on a mid-tier model marked in
per-section batches, this one not at all, so progress visibility cannot
be relied on from the agent's own bookkeeping alone.

## 9. Transport (found by re-running 8.6)

Section 8 wired `AiPanel` correctly, but the model never reaches it: both
delivery targets flatten the resolved config to agent ids before handing
it to the panel, so the model is discarded one layer earlier. Task 7.4
made those call sites compile after the type widened — by dropping the
new field, which is the cheapest way to satisfy a type checker and was
not forbidden by any task. The end-to-end path was never named in a task;
that is the authoring gap, not an implementation error.

Path this change must hold end to end:
`harness.json` → `resolveHarnessConfig` → **transport/context** →
`AiPanel`'s `Command` → adapter `buildInvocation()` → argv.

- [x] 9.1 `packages/extension/src/webview/ai-panel.ts` line ~32: widen
  `AiPanelContext["stepAgents"]` from
  `Partial<Record<"propose"|"review"|"apply", string>>` to
  `HarnessStepAgents` (imported from `@openspec-ui/core`).
- [x] 9.2 `packages/extension/src/webview/ai-panel.ts` lines ~258-262
  (`resolveAndPostStepAgents`): stop calling `normalizeStepAgent(...)
  .agent` on each stage — pass `harnessConfig.stepAgents` through
  unchanged, so the object form and its model survive to the webview.
  The values are JSON-serialized over `postMessage`, which carries the
  object form without further work.
- [x] 9.3 `packages/webui/src/standalone-entry.tsx` line ~266: widen the
  `stepAgents` state type to `HarnessStepAgents | undefined`.
- [x] 9.4 `packages/webui/src/standalone-entry.tsx` lines ~617-621: pass
  `config.stepAgents` through unchanged, same reasoning as 9.2.
- [x] 9.5 `packages/extension/src/webview/ai-panel.test.ts`: the context
  message posted to the webview carries a stage's model when the resolved
  config has the object form.
- [x] 9.6 `npm run typecheck`/`lint`/`test` for `openspec-ui-vscode`,
  `@openspec-ui/webui` and `@openspec-ui/server` — all green, including
  `server/src/static.test.ts`.
- [x] 9.7 **Human-only**: rebuild and reinstall
  (`npm run reinstall:local --workspace openspec-ui-vscode`), reload the
  window, run a real `implement` on a change whose `harness.json` sets a
  model, and confirm the spawned process command line contains
  `--model <value>`. This is the third attempt at this check; the two
  previous ones failed at a different layer each time.


Verified 2026-09-01 (7.8 / 8.6 / 9.7, one live run): with a per-change
`harness.json` setting `apply` to `{ agent: claude-cli, model:
`claude-haiku-4-5` }` and the global CLI default left at `opus`, the
spawned process was `claude -p --output-format text
--dangerously-skip-permissions --model claude-haiku-4-5`. Run via a
`semi-autonomous` chain, so the chain path is covered too. Took three
attempts, each failing at a different layer (adapter, panel, transport) —
the reason rule 6 was added to task-granularity-rules.
