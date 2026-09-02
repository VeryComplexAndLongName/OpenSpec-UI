These documents are read by people deciding what to spend money on. Every
number, flag and agent id in them must be read out of the source, not
recalled — and where the source and the document disagree, the document
is not the thing to adjust. Two settings shipped this week that read as
effective and were not; a reference page is the cheapest instrument for
finding the third.

## 1. `HARNESS.md`

- [ ] 1.1 New `HARNESS.md` at the repository root: what the harness is in
  one paragraph, then the stage sequence `propose → review → apply →
  verify → archive → git`, saying for each what runs it and what it
  produces. State that `archive` is mechanical and `git` is gated — a
  reader must not have to infer either from a table.
- [ ] 1.2 Same file: the two configuration files —
  `openspec/agent-harness.json` and a per-change
  `openspec/changes/<id>/harness.json` — with the merge rule, and the
  settings a global file may **not** set (`autonomyLevel: "autonomous"`,
  `reviewGate.mode: "agent-sufficient"`,
  `checkpoints.requireConfirmationBetweenSteps: false`, the git-stage
  allowlist) and why.
- [ ] 1.3 Same file: every key with its accepted values — `stepAgents`,
  `autonomyLevel`, `reviewGate`, `checkpoints`, `budget`,
  `gitStageAllowlist`. Read them out of `harness-config.ts`, not from
  memory.
- [ ] 1.4 Same file: a worked `agent-harness.json` and a worked
  `harness.json`, both of which must actually load. Asserted by task 6.3
  rather than trusted.
- [ ] 1.5 Same file: where each setting is edited in the standalone UI
  and in VS Code, with the screenshots from section 3.
- [ ] 1.6 Same file: mechanical checks — the six names, the check
  declaration syntax a task line may carry, and that a failing check
  skips the verifying agent entirely.

## 2. Agents, models, effort — the reference table

- [ ] 2.1 `HARNESS.md`: one table with a row per agent id. Columns: id,
  what it runs, accepts a model, accepts an effort and which values,
  accepts a spending cap and in which unit, run against the real binary
  here. Ten rows — `claude-cli`, `copilot-cli`, `codex-cli`,
  `gemini-cli`, `local-llm`, `claude-cli-acp`, `copilot-cli-acp`,
  `codex-cli-acp`, `gemini-cli-acp`, `vscode-chat`.
- [ ] 2.2 Fill the effort and budget columns from
  `HARNESS_AGENT_CAPABILITIES` in `harness-step-agent.ts`, and the model
  column from `modelFlag` in `agents/registry.ts`. Do **not** write them
  from the adapters: the validator reads that table, so the table is what
  a user's configuration is actually judged against.
- [ ] 2.3 The "run against the real binary here" column repeats what
  `README.md`'s agent table already says: **never**, for `codex` and
  `gemini`, with the reason. A user choosing one of those needs it before
  the run, not after.
- [ ] 2.4 State what changes when an `-acp` id is chosen instead of its
  plain counterpart: structured progress instead of scraped text, a
  permission gate where the agent offers one, and a recorded agent
  version compared against the version this project verified. Name
  `claude-cli-acp`'s documented exception — progress only, no permission
  gate.
- [ ] 2.5 **`copilot-cli-acp` and `claude-cli-acp` currently refuse
  `effort` and `budget`, though their adapters render the flags and the
  allowlist permits them.** Do **not** document the refusal as intended
  behavior, and do **not** fix it here: it is a defect, tracked as
  `acp-agent-capabilities`. Whichever change lands second updates the
  table. Until then the document states the current behavior and links
  the change.

## 3. Screenshots

- [ ] 3.1 New Playwright spec under `packages/server/e2e/` whose product
  is `docs/images/standalone/harness-*.png`: the global settings section,
  a per-change override, and a run in progress showing a checkpoint.
- [ ] 3.2 Document the one command that regenerates them, in `HARNESS.md`
  and in the spec's own header comment.
- [ ] 3.3 Do **not** add an image-diff gate to CI. Font and platform
  rendering make those noisy, and a check that cries wolf is what this
  repository has spent the week removing. Revisit once the images have
  proven stable across a few runs.
- [ ] 3.4 Re-capture the VS Code screenshots by hand and label each with
  the date and extension version it shows. Nothing here can automate
  them — the extension's own host has not been startable in this
  environment (see `audit-log-persistence` task 4.2) — and the label is
  the honest substitute for a guarantee.
- [ ] 3.5 Replace `docs/images/standalone/harness-settings.png`. The
  committed image shows a settings screen that stopped existing three
  commits ago: it predates the effort and budget controls, the chat
  target and the mechanical `archive` row.

## 4. `LIMITS.md`

- [ ] 4.1 New `LIMITS.md` at the repository root: the two independent
  levels. `HarnessConfig.budget` (`maxCostUsd`, `maxTokens`) caps a whole
  chain and is evaluated by `HarnessChainRunner` **between stages**;
  `stepAgents.<stage>.budget` (`maxCostUsd` **or** `maxAiCredits`) is
  passed to one CLI invocation as its own flag. Say plainly that the
  first cannot stop a stage already running.
- [ ] 4.2 Same file: why there is no single `budget: number`. GitHub
  publishes one AI credit as $0.01, and that rate is a vendor decision
  which can change under a configuration that would not notice;
  `--max-ai-credits` has a 30-credit floor; and rounding dollars to whole
  credits either exceeds or tightens the cap the user wrote.
- [ ] 4.3 Same file: which agent honours which field — `claude-cli`
  `--max-budget-usd` (Claude Code v2.1.217 or later), `copilot-cli`
  `--max-ai-credits` (minimum 30). A mismatched field is refused when the
  configuration resolves, not minutes into a run.
- [ ] 4.4 Same file: **what does not exist.** There is no wall-clock or
  duration limit on a harness run, and no per-stage timeout. The
  durations in the code are not user settings —
  `external-waiter.ts`'s `maxDurationMs` (the suspendable stage),
  `gh-pr-gateway.ts`'s `maxWaitMs` (polling a pull request's checks, five
  minutes), agent detection's own timeout, and the CI job ceilings in
  `.github/workflows/quality.yml`. Say it outright: a reader who assumes
  a run cannot exceed some duration will be wrong, and the request that
  prompted this document asked about time limits as though they existed.
- [ ] 4.5 Same file: where the numbers a ceiling is compared against come
  from — the audit log's recorded `usage` — and therefore that a ceiling
  can only count what an agent reported.
- [ ] 4.6 Same file: one sentence pointing at
  `.github/workflows/quality.yml` for CI job timeouts, which are ceilings
  but not harness settings — design.md's open question, resolved this way
  unless review disagrees.

## 5. Links

- [ ] 5.1 `README.md`: a harness section linking both documents. The word
  "harness" does not currently appear in that file at all.
- [ ] 5.2 `packages/server/README.md` and
  `packages/extension/README.md`: link from each one's own harness
  material.
- [ ] 5.3 `AGENTS.md` and `CLAUDE.md`: link, as pointers only. Both files
  say "pointers, not duplicates" and neither may grow a copy of the
  settings tables.
- [ ] 5.4 `docs/adr/README.md`: leave alone. ADRs record decisions, and a
  user-facing guide is not one.

## 6. Verification

- [ ] 6.1 `openspec change validate --strict agentic-harness-documentation`.
- [ ] 6.2 Every agent id in `AGENT_REGISTRY`, plus `vscode-chat`, appears
  in `HARNESS.md`'s table. Assert this with a test over the real file and
  the real registry, not by reading it — a new adapter must not be able
  to land with no row.
- [ ] 6.3 Both worked examples in `HARNESS.md` load through
  `resolveHarnessConfig` without error. Assert it; an example
  configuration that does not parse is worse than none.
- [ ] 6.4 `npm run lint:english` — both documents are English only.
- [ ] 6.5 No `packages/*/src` non-test source file changes, apart from the
  new Playwright spec. This change documents behavior; it does not alter
  it.
- [ ] 6.6 No changeset — documentation and test-only, matching
  `openspec/changes/archive/2026-09-01-ci-job-timeouts/`.
- [ ] 6.7 **Human-only, cannot be completed by an implementing agent**:
  read `HARNESS.md` beside the running settings surface in both hosts and
  confirm each described control exists where the document says it does.
  Nothing automated can compare a sentence to a screen.
