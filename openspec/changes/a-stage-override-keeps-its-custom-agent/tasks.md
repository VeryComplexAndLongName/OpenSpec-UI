The merge knows three fields and the entry carries four. The two
surfaces that apply a configuration to a change disagree. The words for
the middle configuration describe a different arithmetic.

## 1. The merge carries every field

- [x] 1.1 `mergeStepAgent` in `packages/core/src/harness-config.ts`
  merges over `STEP_AGENT_KEYS` rather than three named fields; the
  different-agent rule and the bare-string collapse use the same list.

  Corrected premise: `mergeStepAgent`, `mergeStepAgents` and
  `STEP_AGENT_KEYS` now live in `packages/core/src/harness-step-agent.ts`,
  the zero-Node leaf module, and `harness-config.ts` imports and
  re-exports them. Task 2.1's one core function has to resolve an
  override over the base in the browser bundle too, and a value imported
  from `harness-config.ts` pulls its `node:fs`/`node:path` imports in
  with it. Every existing import path still works.
- [x] 1.2 Its doc comment and `HARNESS.md:62` say "model, effort, budget
  and custom agent", and both say five agents accept no effort.

## 2. One way to apply a configuration to a change

- [x] 2.1 A core function takes the global configuration, the change's
  override and a template, and returns the override to write. The run
  dialog's `applyTemplateToChange` path and the settings view's
  `applyChangeTemplate` both call it.

  `changeTemplateConfigToWrite` in `packages/core/src/harness-templates.ts`.
  Three callers, not two: the VS Code run dialog
  (`packages/extension/src/commands.ts`'s `createRunChoiceHandler`)
  applied a configuration the same way the standalone run dialog did and
  had to move with it.
- [x] 2.2 The settings view's message names the stages given an effort
  and the agents that accept none; "None of the agents on screen takes
  an effort setting" is said only when that is the reason.

  A third fact was needed: a stage with no agent chosen at all is not a
  stage whose agent takes none, and the global section can have both.

## 3. Words that match the arithmetic

  A trade-off this task did not name, decided rather than left to be
  noticed: applying a configuration now fills the change form from
  what the change resolves to, so an agent edited on screen but not
  yet saved is replaced. That follows from 2.1 — the run dialog has
  no form to consult, and one function cannot read one. The message
  names every stage whose agent it changed and says nothing is saved
  until you save, so it is stated, not silent.
- [x] 3.1 `harness-templates.ts`: the intent of `balanced` and `careful`
  describe a position in the range ("a third of the way up", "two
  thirds"), not "the middle".
- [x] 3.2 `HARNESS.md`, "named by the effort they ask for": replace
  "highest, high, medium or lowest of what the agent accepts" with the
  position, and carry the per-agent resolved table from
  `presets-by-effort/design.md` so a reader sees the value before
  choosing.

## 4. Tests

- [x] 4.1 Core: an override naming only `customAgent` over a global
  naming the same agent resolves with the custom agent; a global naming
  `customAgent` survives an override naming only an effort; a different
  agent inherits none of it.

  `harness-config.test.ts`, "the merge carries every field the entry may
  carry" — six tests, including one asserted over `STEP_AGENT_KEYS`
  rather than over named fields, and one pinning that the merge and
  `templateConfigToWrite` produce the same entry.
- [x] 4.2 Core: the apply-to-change function produces one file for one
  input, asserted from both callers' inputs.

  `harness-templates.test.ts`, "one file, whichever surface applied it".
- [x] 4.3 Webui: the settings view, applying a template to a change whose
  override names no stage, writes an effort for each stage whose global
  agent accepts one, and says so.

  `HarnessSettingsView.test.tsx`, "applied against what the change
  resolves to" — three tests over a global naming `claude-cli`,
  `gemini-cli` and `codex-cli` with `verify` left unset, so the message
  has all three cases to tell apart.
- [x] 4.4 A test over every registered agent asserting the intent text
  of each template does not claim a value the resolver does not produce.

  `harness-templates.test.ts`, "the words describe the position the
  resolver produces". A positional phrase in a template's own prose is
  checked against `resolveEffortLevel` for every agent with a
  vocabulary, plus a guard that the check is not reading an empty set.

## 5. Verification

- [x] 5.1 `openspec validate --strict --changes`.

  Run 2026-09-10 with `openspec` 1.7.0: `Totals: 9 passed, 0 failed
  (9 items)`.
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.

  Run 2026-09-10, redirected to a log, exit 0. `check-english` 4 tests,
  `check-test-budgets` 10 tests, `@openspec-ui/cli` 48 in 4 files,
  `@openspec-ui/core` 867 in 61 files, `openspec-ui-vscode` 320 in 24
  files, `@openspec-ui/server` 79 in 4 files, `@openspec-ui/webui` 359
  in 42 files.

  The browser suite as well, since this change edits a view it renders:
  `npm run test:browser --workspace @openspec-ui/server`, 11 passed in
  3.3m. It rewrote the four `docs/images/standalone/*.png` it exists to
  capture.
  Browser suite run whole, not only the specs this change touches:
  11 passed in 4.4 minutes. It rewrote four screenshots under
  `docs/images/standalone/`; two are this change's own settings
  view, two had gone stale against a-schedule-keeps-its-promise,
  which changed the run dialog and merged without them.
- [x] 5.3 Version bump via `npx changeset` for core and webui.

  Corrected premise: three packages, not two.
  `.changeset/stage-override-keeps-its-custom-agent.md` bumps
  `@openspec-ui/core`, `@openspec-ui/webui` and `openspec-ui-vscode` —
  the VS Code run dialog applies a configuration through the same core
  function and changed with it (see 2.1).
- [ ] 5.4 **Delegated to copilot-cli**: this is a live run, and
  `copilot-cli` is an agent whose CLI accepts `--agent`. Against a
  scratch change, set the global config's `apply` stage to `copilot-cli`
  and the change's override to the same agent plus a `customAgent` — the
  case the merge drops today — run the chain, and read
  `.openspec-ui/audit.jsonl` for the entry whose command carries
  `--agent <name>`. Evidence to record here: the run id and the audit
  line, quoted.
