Path this change must hold end to end: `agent-harness.json` **or**
`openspec/changes/<id>/harness.json` → `resolveHarnessConfig`'s deep merge
→ the transport → `Command` → `buildInvocation()` → argv → the allowlist →
the spawned process. This is the same path `harness-step-models` needed
three separate rounds to close, because each round widened one layer and
the next layer quietly dropped the value. Check every junction, not the
two ends.

Notes on local checks, both unrelated to this change:
`npm run lint` fails here with `ENOENT ...
openspec/changes/agent-detection-timeout/.openspec.yaml`, from a
concurrent session's uncommitted archive moves. And a green local run
proves nothing about POSIX-only branches — CI's Linux runner is the only
place they execute (see `harness-cancel-stops-the-run` tasks 5.7/5.8).

## 1. Configuration shape

- [ ] 1.1 `packages/core/src/harness-step-agent.ts`: add
  `export type HarnessEffort = "none" | "minimal" | "low" | "medium" |
  "high" | "xhigh" | "max"` — the union of every value any agent accepts,
  not the intersection. Keep this module's zero non-type imports: it is
  re-exported as a value through `@openspec-ui/core/browser`.
- [ ] 1.2 Same file: `HarnessStepAgent`'s object form gains
  `effort?: HarnessEffort` and `budget?: { maxCostUsd?: number;
  maxAiCredits?: number }`. Both optional. Do **not** add a single shared
  `budget: number`. A conversion does exist — GitHub publishes one AI
  credit as $0.01 — and design.md rejects using it anyway: the rate is a
  vendor decision that can change under a configuration that would not
  notice, `--max-ai-credits` has a 30-credit floor that a dollars field
  would have to special-case immediately, and rounding a dollar amount to
  whole credits either exceeds or tightens the cap the user wrote.
- [ ] 1.3 Same file: `normalizeStepAgent` carries both through. The bare
  string form keeps working and yields neither field.
- [ ] 1.4 Same file: export, per agent id, which effort values that agent
  accepts and which budget field it honours. This table is what tasks 2.x
  and 3.x both read; do not duplicate the knowledge in an adapter and in
  the validator.

## 2. Validation at configuration time

- [ ] 2.1 `packages/core/src/harness-config.ts`: a stage entry whose
  `effort` is not in its agent's accepted set is rejected when the
  configuration resolves, with an error naming the agent, the value, and
  the accepted values — not when the run fails minutes later.
- [ ] 2.2 Same file: a stage entry setting `effort` for an agent that has
  no command-line effort mechanism at all (`gemini-cli`) is **rejected**.
  Do **not** ignore it. A silently ignored setting means the user paid for
  a run that did not do what they configured and was never told.
- [ ] 2.3 Same file: a stage entry setting a budget field its agent does
  not honour is rejected the same way — `maxCostUsd` on `copilot-cli`, or
  `maxAiCredits` on `claude-cli`.
- [ ] 2.4 Same file: both fields resolve through the existing global +
  per-change deep merge, unchanged. A per-change value overrides a global
  one for that stage; neither field is restricted to one file, unlike
  `autonomyLevel: "autonomous"`.
- [ ] 2.5 `harness-config.test.ts`: a global-only value, a per-change-only
  value, and a per-change value overriding a global one each resolve as
  expected; an invalid effort, an effort on `gemini-cli`, and a
  mismatched budget field each produce their named error.

## 3. Adapters

- [ ] 3.1 `packages/core/src/agents/claude.ts`: append `--effort <level>`
  when set, and `--max-budget-usd <amount>` when set. Live-verified flags
  (`claude --help`, 2026-09-02): effort takes `low, medium, high, xhigh,
  max`, and `--max-budget-usd` works only with `--print`, which this
  adapter already passes as `-p`.
- [ ] 3.2 `packages/core/src/agents/copilot.ts`: append `--effort <level>`
  when set, and `--max-ai-credits <credits>` when set. Live-verified:
  effort additionally accepts `none` and `minimal`; the credit minimum is
  30, so a smaller value is rejected at configuration time by task 2.3's
  validator rather than by the CLI.
- [ ] 3.3 `packages/core/src/agents/codex.ts`: append
  `-c model_reasoning_effort="<level>"` when set, and nothing for budget.
  Render that **one** key only — `-c` reaches codex's whole configuration
  surface, and admitting the flag rather than the setting would open the
  argv allowlist far wider than this feature needs.
- [ ] 3.4 `packages/core/src/agents/gemini.ts`: render nothing for either
  field. Its effort control is the interactive `/model` menu, with no
  command-line equivalent; task 2.2's rejection is what the user sees.
- [ ] 3.5 `packages/core/src/agents/claude.ts`: `--max-budget-usd`
  requires Claude Code **v2.1.217 or later** (upstream docs, cited in
  proposal.md). `packages/core/src/verified-agent-versions.ts` already
  holds the version this project verified against; add the minimum for
  this flag beside it rather than inventing a second place to record a
  version. Do **not** add a runtime version check here — detection already
  captures the observed version (`agent-usage-accounting`), and a second
  `--version` spawn is what ADR 0017 decision 6 rejects.
- [ ] 3.6 No adapter changes any argv it already produced. A stage entry
  without the new fields must yield a byte-identical command line.

## 4. Allowlist

- [ ] 4.1 `packages/core/src/default-runners.ts`: replace
  `exactWithOptionalModel` with a matcher taking the expected prefix plus
  an ordered table of permitted optional pairs — flag name to value
  validator — and requiring the same order the adapter renders.
- [ ] 4.2 Same file: each optional value has its own validator —
  `MODEL_ID_PATTERN` for a model, membership of the agent's accepted set
  for an effort, a positive finite number for a budget. Do **not** reuse
  `MODEL_ID_PATTERN` for effort: it would admit any word-shaped string,
  which is exactly the check task 2.1 exists to make precise.
- [ ] 4.3 Same file: for `codex-cli`, match the whole pair including the
  key — `-c` followed by `model_reasoning_effort="<accepted level>"` — and
  nothing else beginning with `-c`.
- [ ] 4.4 Same file: keep the matcher **closed**. Any argv that is not the
  expected prefix plus a permitted subset of these pairs, in order, is
  still refused.
- [ ] 4.5 `default-runners.test.ts`: today's argv still matches; each new
  pair matches when valid; an unknown flag, an out-of-set effort, a
  non-numeric budget, and `-c` with any other key are each refused.

## 5. Surfaces

- [ ] 5.1 `packages/webui/src/components/HarnessSettingsView.tsx`: both
  fields per stage, offering only the values that stage's agent accepts.
- [ ] 5.2 `packages/extension`: the same, wherever it presents the same
  settings.
- [ ] 5.3 Neither surface may offer a value the validator would reject —
  the picker and the validator read the table from task 1.4.

## 6. Verification

- [ ] 6.1 `openspec change validate --strict harness-step-effort-and-budget`.
- [ ] 6.2 `npm run typecheck` and `npm run test` — green across all four
  workspaces. See the notes at the top of this file.
- [ ] 6.3 `packages/server/src/static.test.ts`'s esbuild browser-bundle
  check stays green — task 1.1's constraint on `harness-step-agent.ts`.
- [ ] 6.4 A stage entry with neither field produces a byte-identical argv
  to before this change, asserted per adapter (task 3.6).
- [ ] 6.5 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the packages whose settings surface changed).
- [ ] 6.6 **Human-only, cannot be completed by an implementing agent**:
  set `effort` and a budget on a stage in the global
  `openspec/agent-harness.json`, run it, and confirm from the spawned
  process's own command line that both reached argv — the check that
  caught `harness-step-models` failing three times. Then set a different
  value in a per-change `harness.json` and confirm it overrides.
- [ ] 6.7 **Human-only, and blocked**: `codex-cli`'s and `gemini-cli`'s
  behavior is taken from upstream documentation — neither binary is
  installed on this machine. Before tasks 3.3 and 3.4 may be considered
  verified, run each CLI's `--help` on a machine that has it and confirm
  the mechanism. Until then this task stays outstanding, and the safe
  defaults hold: `codex` renders one narrow override, `gemini` refuses.
