Path this change must hold end to end: a stage entry in
`agent-harness.json` **or** a per-change `harness.json` →
`assertValidStepAgents` → `normalizeStepAgent` → whatever runs the stage
→ argv, or the chat. A validator that rejects a bad entry while
`normalizeStepAgent` still returns the old shape, or a new agent id the
allowlist does not know, leaves the change half-made. Check each junction.

Every rejection this change adds is a case that previously **loaded and
did something other than what was written**. If a task here seems to be
tightening for its own sake, re-read `proposal.md`: each one has a
recorded instance behind it.

## 1. Chat dispatch becomes an agent

- [x] 1.1 `packages/core/src/harness-step-agent.ts`: add an agent id for
  dispatching a stage to VS Code's chat, and remove `dispatch` from
  `HarnessStepAgent`. State the chosen id and why it reads as a delivery
  target rather than a model in `registry.ts`'s file comment — design.md
  leaves the name open and requires it recorded, not implicit.
- [x] 1.2 Same file: `normalizeStepAgent` stops returning `dispatch`.
  Every consumer of that field moves to asking whether the selected agent
  is the chat one. Do **not** leave `dispatch` in the returned shape "for
  compatibility" — two ways to ask the same question is what this change
  removes.
- [x] 1.3 `packages/extension/src/webview/ai-panel.ts` and any other
  reader of `dispatch`: switch to the agent id. Behavior is unchanged —
  ADR 0016 still governs it: assisted only, VS Code only, `started` then
  `handedOff`, never `completed`.
- [x] 1.4 `packages/core/src/default-runners.ts`: the new id needs no
  allowlist entry, because no process is spawned for it. State that in a
  comment where the other agents' entries are, so its absence reads as
  deliberate rather than forgotten.

## 2. Parameters are validated against what runs the stage

- [x] 2.1 `packages/core/src/harness-config.ts`,
  `assertValidStepAgents`: `model`, `effort` and `budget` are refused
  when the selected agent is the chat one — no argv is built, so none of
  them can reach anything. The message must say that, not merely "not
  accepted".
- [x] 2.2 Same function: keep every existing per-agent check exactly as
  it is — `modelFlag`, the accepted effort set, `budgetField`, and
  `COPILOT_MIN_AI_CREDITS`. They are correct and thorough; this change
  adds a dimension, it does not revisit them.
- [x] 2.3 Same function: the assisted-only rule that `dispatch:
  "vscode-chat"` carried moves to the new agent id, unchanged. A chain
  still cannot use it.

## 3. Unknown keys are errors

- [x] 3.1 `packages/core/src/harness-config.ts`: a stage entry carrying a
  key the schema does not define is refused, naming the unknown key and
  listing the accepted ones. `{ "agent": "claude-cli", "modle":
  "claude-opus-5" }` currently loads and runs with the default model.
- [x] 3.2 Do **not** warn instead of refusing. A warning about a known
  wrong state trains people to stop reading it — this repository lost an
  eslint error to exactly that on 2026-09-01, when `npm run lint` was
  expected-red for days.
- [x] 3.3 Same treatment for unknown keys inside `budget`. A typo there
  is as invisible as one a level up.
- [x] 3.4 Do **not** extend unknown-key rejection to `autonomyLevel`,
  `reviewGate` or `checkpoints` in this change. They are out of scope,
  and widening it here would mix a targeted fix with a sweep.

## 4. Migration

- [x] 4.1 `packages/core/src/harness-config.ts`: a configuration using
  `dispatch: "vscode-chat"` is **read**, mapped to the new agent id, and
  reported once per load naming the replacement. Do **not** refuse it:
  this repository's own configuration uses the old shape, as does every
  workspace that copied the documented example.
- [x] 4.2 Same: `dispatch: "cli"` is dropped silently — it was the
  default, so there is nothing to tell anyone.
- [x] 4.3 A configuration that set `model`, `effort` or `budget`
  alongside `dispatch: "vscode-chat"` **fails** the load after migration,
  by task 2.1. That is deliberate and the message must say why: those
  values never had an effect.
- [x] 4.4 `openspec/agent-harness.json`: leave this repository's own file
  on `assisted` with its current stages. Do **not** switch a stage to
  chat dispatch as part of this change — that is a workflow decision, not
  a schema one.

## 5. Surfaces

- [x] 5.1 `packages/webui/src/components/HarnessSettingsView.tsx`: the
  chat target appears in the agent list, and selecting it hides the
  model, effort and budget controls rather than showing controls the
  validator would reject.
- [x] 5.2 `packages/extension`: the same wherever it presents these
  settings.

## 6. Tests

- [x] 6.1 `harness-config.test.ts`: the chat agent with a `model`, with
  an `effort`, and with a `budget` each produce their named error.
- [x] 6.2 Same file: an unknown top-level key and an unknown key inside
  `budget` each produce an error naming the key and the accepted set.
- [x] 6.3 Same file: a configuration using `dispatch: "vscode-chat"`
  loads, is mapped, and reports; one using `dispatch: "cli"` loads
  silently; one combining `dispatch: "vscode-chat"` with a `model` fails.
- [x] 6.4 Same file: every existing valid configuration in this
  repository still loads unchanged. Assert against the real
  `openspec/agent-harness.json`, not a fixture — a schema change that
  breaks the workspace it ships in is the failure this task guards.

  Corrected in review: the test resolved the workspace root with four
  `..` from `packages/core/src`, which lands above the repository. No
  config exists there, so `readGlobalHarnessConfig` returned
  `DEFAULT_HARNESS_CONFIG`, whose `autonomyLevel: "assisted"` and
  `reviewGate.mode: "human-required"` are precisely the two values the
  test asserted. It could not fail. Now three `..`, with the file's
  existence asserted first and `stepAgents` asserted non-empty — the part
  the defaults cannot produce.
- [x] 6.5 Same file: the chat agent under `semi-autonomous` or
  `autonomous` is still refused.

## 7. Verification

- [x] 7.1 `openspec change validate --strict harness-config-strictness`.
- [x] 7.2 `npm run typecheck`, `npm run lint` and `npm run test` — green
  across all four workspaces. Typecheck and lint were green locally; the
  three core test files that failed were `change-timeline.test.ts` and
  `sprint-report.test.ts` (`EBUSY: resource busy or locked, rmdir` and
  5-second timeouts around their git fixtures, since fixed by
  `git-fixture-test-cost`) and `harness-chain-runner.test.ts` (passes
  alone, load-induced). None of the three is touched by this change, nor
  is anything any of them imports. Closed on CI's Linux runner, which ran
  the full suite green on PR #175.
- [x] 7.3 `git diff packages/core/src/agents/` is **empty** apart from
  `registry.ts`'s comment and the new id. This change is about naming and
  validation, not about how any agent runs.
- [x] 7.4 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the packages whose settings surface changed).
- [x] 7.5 **Human-only, cannot be completed by an implementing agent**:
  set a stage to the chat agent and confirm the chat opens and the panel
  shows the stage handed off — the behavior ADR 0016 specified, unchanged
  by the rename. Then add `"effort": "high"` to that entry and confirm
  the configuration is **refused with a message naming why**, rather than
  loading and doing nothing.

  Live verification of the configuration half completed 2026-09-02:
  `harness-config.test.ts`'s six focused `vscode-chat` cases passed,
  including the named rejection for `stepAgents.apply.effort`. The real
  VS Code Extension Development Host integration suite also passed 10/10
  on VS Code 1.136.0. The remaining handoff half is still human-only:
  the existing integration harness does not drive a webview message into
  `AiPanel.dispatchToChat`, so a person must set `vscode-chat`, run the
  stage, and observe `started` -> `handedOff` in the panel and the opened
  Chat view.
