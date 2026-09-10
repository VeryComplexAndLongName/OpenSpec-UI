The merge knows three fields and the entry carries four. The two
surfaces that apply a configuration to a change disagree. The words for
the middle configuration describe a different arithmetic.

## 1. The merge carries every field

- [ ] 1.1 `mergeStepAgent` in `packages/core/src/harness-config.ts`
  merges over `STEP_AGENT_KEYS` rather than three named fields; the
  different-agent rule and the bare-string collapse use the same list.
- [ ] 1.2 Its doc comment and `HARNESS.md:62` say "model, effort, budget
  and custom agent", and both say five agents accept no effort.

## 2. One way to apply a configuration to a change

- [ ] 2.1 A core function takes the global configuration, the change's
  override and a template, and returns the override to write. The run
  dialog's `applyTemplateToChange` path and the settings view's
  `applyChangeTemplate` both call it.
- [ ] 2.2 The settings view's message names the stages given an effort
  and the agents that accept none; "None of the agents on screen takes
  an effort setting" is said only when that is the reason.

## 3. Words that match the arithmetic

- [ ] 3.1 `harness-templates.ts`: the intent of `balanced` and `careful`
  describe a position in the range ("a third of the way up", "two
  thirds"), not "the middle".
- [ ] 3.2 `HARNESS.md`, "named by the effort they ask for": replace
  "highest, high, medium or lowest of what the agent accepts" with the
  position, and carry the per-agent resolved table from
  `presets-by-effort/design.md` so a reader sees the value before
  choosing.

## 4. Tests

- [ ] 4.1 Core: an override naming only `customAgent` over a global
  naming the same agent resolves with the custom agent; a global naming
  `customAgent` survives an override naming only an effort; a different
  agent inherits none of it.
- [ ] 4.2 Core: the apply-to-change function produces one file for one
  input, asserted from both callers' inputs.
- [ ] 4.3 Webui: the settings view, applying a template to a change whose
  override names no stage, writes an effort for each stage whose global
  agent accepts one, and says so.
- [ ] 4.4 A test over every registered agent asserting the intent text
  of each template does not claim a value the resolver does not produce.

## 5. Verification

- [ ] 5.1 `openspec validate --strict --changes`.
- [ ] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.
- [ ] 5.3 Version bump via `npx changeset` for core and webui.
- [ ] 5.4 **Delegated to copilot-cli**: this is a live run, and
  `copilot-cli` is an agent whose CLI accepts `--agent`. Against a
  scratch change, set the global config's `apply` stage to `copilot-cli`
  and the change's override to the same agent plus a `customAgent` — the
  case the merge drops today — run the chain, and read
  `.openspec-ui/audit.jsonl` for the entry whose command carries
  `--agent <name>`. Evidence to record here: the run id and the audit
  line, quoted.
