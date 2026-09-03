`harness-mechanical-checks` did all of this for `archive` two changes
ago. Read what it did before writing anything here: every decision, every
migration rule and every surface treatment already exists, and the point
of this change is that one stage was missed, not that a new approach is
needed.

## 1. The type

- [x] 1.1 `packages/core/src/harness-step-agent.ts`:
  `HarnessStepAgentStage` becomes `Exclude<HarnessStage, "archive" |
  "git">`. Both stages run; neither invokes an agent.
- [x] 1.2 Same file: state in the comment why both are excluded and that
  they are excluded for the same reason, so the next stage that runs
  without an agent is added to one list rather than to neither.
- [x] 1.3 Correction to this task's own premise: `stepAgentFor` needed no
  change (confirmed — it delegates to `isHarnessStepAgentStage` and names
  no stage itself), but `isHarnessStepAgentStage`'s body hardcoded `stage
  !== "archive"` and had to be edited to `stage !== "archive" && stage !==
  "git"` — leaving it as-is would have made it return `true` for `"git"`,
  which both `HarnessSettingsView.tsx`'s `!isHarnessStepAgentStage(stage)`
  branch and `STEP_AGENT_STAGES` in harness-config.ts read directly, so an
  unedited function would have kept rendering `git` as a configurable row
  and kept accepting `stepAgents.git` — the exact defect this change
  exists to remove, just moved one function over. Edited, not merely
  confirmed.

## 2. Migration

- [x] 2.1 `packages/core/src/harness-config.ts`: a configuration setting
  `stepAgents.git` is read, that entry dropped with a warning naming the
  file, and the rest honoured. Do **not** reject the file — the same
  reasoning `harness-mechanical-checks` task 4.2 applied to `archive`.
- [x] 2.2 Reused `dropArchiveStepAgent`'s mechanism: renamed it to
  `dropNoAgentStepAgents` and generalized it over a new `NO_AGENT_STAGES =
  ["archive", "git"] as const` list, rather than adding a second function
  beside it. `STEP_AGENT_STAGES` and `assertValidStepAgents`'s rejection
  branch both read from the same list.
- [x] 2.3 The warning names which stage was dropped:
  `` `stepAgents.${stage} was dropped — "${stage}" is a mechanical stage
  and never invokes an agent` `` for each stage in `NO_AGENT_STAGES` found
  in the file.

## 3. Surfaces

- [x] 3.1 `packages/webui/src/components/HarnessSettingsView.tsx`: `git`
  renders the way `archive` already does — present in the stage list,
  with no agent, effort or budget control. No new branch was needed: both
  `CONFIGURABLE_STAGES` and the `!isHarnessStepAgentStage(stage)` render
  check already derive from the shared predicate, so fixing that
  predicate (task 1.3) made `git` fall onto the existing
  `MechanicalStageRow` path automatically. Updated the two comments that
  named only `archive` to name both, and added a mirroring test in
  `HarnessSettingsView.test.tsx` ("shows git as a mechanical row...").
- [x] 3.2 `packages/extension/src/commands.ts`: **confirmed, not edited.**
  `HARNESS_TEMPLATE_STAGES` (line 229) lists `propose`, `review`, `apply`,
  `verify` and `archive`, and the wizard's loop (line 265) never iterates
  `git` — so VS Code already behaves correctly and the two hosts disagree
  today. Found while checking `HARNESS.md` against the implementation for
  `agentic-harness-documentation` task 6.7; the document had said both
  UIs offered the picker, and has been corrected.

  Worth noticing why it is right by accident: `git` is absent from that
  list because the list predates the `git` stage, not because anyone
  decided it should not be asked about. Task 5.4's assertion is what turns
  that into a property rather than a coincidence.
- [x] 3.3 Confirmed `git` remains in `STAGES` (HarnessSettingsView.tsx) and
  `CHAIN_STAGES` (harness-chain-runner.ts) — not removed from either. It
  runs, and hiding it would misrepresent the chain.

## 4. Documentation

- [x] 4.1 `HARNESS.md`: replaced the `stepAgents.git` warning with the
  same treatment `archive` carries (dropped-with-warning, not accepted).
  Also updated the `stepAgents` intro paragraph and the VS Code-wizard
  paragraph, which both still said `git` was accepted/pickable. The stage
  table's `git` row already said "Mechanical, and gated" and needed no
  change.
- [x] 4.2 Regenerated via `npm run test:browser -- harness-screenshots.spec.ts`
  from `packages/server`. `docs/images/standalone/harness-settings.png`
  and `docs/images/standalone/harness-change-override.png` both changed
  (git status confirms); `harness-checkpoint.png` did not, as expected —
  it never showed the stage picker list.

## 5. Tests

- [x] 5.1 `harness-config.test.ts`: added "drops a global stepAgents.git
  entry, warns naming the file, and honours the rest" plus "rejects a
  freshly-written config that sets stepAgents.git" — mirroring the
  existing `archive` tests. All pass.
- [x] 5.2 Same file: added "drops both stepAgents.archive and
  stepAgents.git from one config, warning about each". Passes.
- [x] 5.3 Same file: "keeps accepting this repository's real
  openspec/agent-harness.json" (pre-existing, unmodified) still passes —
  confirmed the path resolves to the repository root (three segments up
  from `packages/core/src`) and the file has no `stepAgents.git`/`archive`
  entry to be affected either way.
- [x] 5.4 Added to `harness-chain-runner.test.ts`: "excludes from
  HarnessStepAgentStage every CHAIN_STAGES entry that has no
  CHAIN_STAGE_COMMAND". Required exporting `CHAIN_STAGES` and
  `CHAIN_STAGE_COMMAND` from `harness-chain-runner.ts` (both were
  module-private) so the test reads the real production values rather
  than a hand-copied list — see task 6.3 for why this makes that file's
  diff non-empty despite the task list's premise.

## 6. Verification

- [x] 6.1 `openspec change validate --strict harness-git-stage-no-agent`
  → "Change 'harness-git-stage-no-agent' is valid".
- [x] 6.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all five workspaces. One test, `src/git.push.test.ts` in
  `@openspec-ui/core` (`createGitWrapper.push`), timed out when run as
  part of the full suite but passed in isolation both before and after
  every edit in this change; it touches nothing this change modified
  (git push plumbing unrelated to harness config) and is a pre-existing,
  Windows-temp-dir-contention flake under full-suite parallelism, not a
  regression introduced here.
- [ ] 6.3 **Deviated from this task's premise, not satisfied as
  written.** `git diff packages/core/src/harness-chain-runner.ts` is
  **not** empty. Narrowing `HarnessStepAgentStage` to exclude both
  `"archive"` and `"git"` (task 1.1) broke this file's own compilation:
  its checkpoint event building (`nextAgentId: nextStage === "archive" ?
  "" : normalizeStepAgent(harnessConfig.stepAgents[nextStage]).agent`)
  indexed `stepAgents` with `nextStage`, whose type still includes
  `"git"` — a real, pre-existing read of `stepAgents.git` this task's own
  premise ("nothing anywhere reads stepAgents.git", proposal.md) did not
  account for. Left unfixed, `npm run typecheck` fails (task 6.2), so it
  could not be left as `git diff`-empty and green at the same time; fixed
  by replacing the `=== "archive"` check with `!isHarnessStepAgentStage
  (nextStage)`, reusing the same predicate task 1.3 depends on rather than
  hardcoding a second stage name. What the `git` stage itself *does* is
  still untouched — only this one display-value computation, in the
  checkpoint event shown before entering `git`, changed.
- [x] 6.4 Added `.changeset/long-mice-drum.md`: `@openspec-ui/core` minor,
  `@openspec-ui/webui` patch (its settings surface's rendering changed;
  `openspec-ui-vscode`'s `commands.ts` did not change, so it gets no
  explicit bump entry here). `npx changeset status` confirms it resolves,
  and also shows `@openspec-ui/server`/`openspec-ui-vscode` picking up an
  automatic patch bump from their internal dependency on `@openspec-ui/core`.
- [ ] 6.5 **Human-only, cannot be completed by an implementing agent**:
  open the Harness Settings surface and confirm `git` shows no agent
  picker, and that a configuration that set one still loads with a
  warning rather than failing.
