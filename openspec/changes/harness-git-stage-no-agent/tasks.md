`harness-mechanical-checks` did all of this for `archive` two changes
ago. Read what it did before writing anything here: every decision, every
migration rule and every surface treatment already exists, and the point
of this change is that one stage was missed, not that a new approach is
needed.

## 1. The type

- [ ] 1.1 `packages/core/src/harness-step-agent.ts`:
  `HarnessStepAgentStage` becomes `Exclude<HarnessStage, "archive" |
  "git">`. Both stages run; neither invokes an agent.
- [ ] 1.2 Same file: state in the comment why both are excluded and that
  they are excluded for the same reason, so the next stage that runs
  without an agent is added to one list rather than to neither.
- [ ] 1.3 `isHarnessStepAgentStage` and `stepAgentFor` need no change
  beyond the type — they were written for exactly this. Confirm rather
  than edit.

## 2. Migration

- [ ] 2.1 `packages/core/src/harness-config.ts`: a configuration setting
  `stepAgents.git` is read, that entry dropped with a warning naming the
  file, and the rest honoured. Do **not** reject the file — the same
  reasoning `harness-mechanical-checks` task 4.2 applied to `archive`.
- [ ] 2.2 Reuse `dropArchiveStepAgent`'s mechanism rather than adding a
  second one beside it. Two functions doing the same thing to two stage
  names is how the next one gets forgotten, which is how this change came
  to exist.
- [ ] 2.3 The warning names which stage was dropped. "A stepAgents entry
  was dropped" leaves the reader to guess which of their settings stopped
  applying.

## 3. Surfaces

- [ ] 3.1 `packages/webui/src/components/HarnessSettingsView.tsx`: `git`
  renders the way `archive` already does — present in the stage list,
  with no agent, effort or budget control. The `MechanicalStageRow` path
  exists; add the case, do not build a second one.
- [ ] 3.2 `packages/extension/src/commands.ts`: `git` is skipped by the
  wizard's per-stage questions the way `archive` already is.
- [ ] 3.3 Do **not** remove `git` from either stage list. It runs, and
  hiding it would misrepresent the chain.

## 4. Documentation

- [ ] 4.1 `HARNESS.md`: replace the `stepAgents.git` warning with the
  same sentence `archive` carries. The stage table's `git` row already
  says "Mechanical, and gated" and needs no change.
- [ ] 4.2 Regenerate `docs/images/standalone/harness-settings.png` — the
  committed one shows the `git` picker this change removes. The command
  is in `HARNESS.md`; the spec is
  `packages/server/e2e/harness-screenshots.spec.ts`.

## 5. Tests

- [ ] 5.1 `harness-config.test.ts`: a config with `stepAgents.git` loads,
  warns naming `git`, and yields a config without it — mirroring the
  existing `archive` test.
- [ ] 5.2 Same file: a config with **both** `stepAgents.archive` and
  `stepAgents.git` drops both and warns about both.
- [ ] 5.3 Same file: this repository's real `openspec/agent-harness.json`
  still loads. Check the path resolves to the repository root — task 6.4
  of `harness-config-strictness` passed for days while pointing one level
  above it.
- [ ] 5.4 A test that every stage in `CHAIN_STAGES` without an entry in
  `CHAIN_STAGE_COMMAND` is excluded from `HarnessStepAgentStage`. This is
  the assertion that would have caught the miss: `git` was added to one
  and not the other, in the same pull request.

## 6. Verification

- [ ] 6.1 `openspec change validate --strict harness-git-stage-no-agent`.
- [ ] 6.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all five workspaces.
- [ ] 6.3 `git diff packages/core/src/harness-chain-runner.ts` is
  **empty**. What the `git` stage does is settled; this change is about
  what may be configured for it.
- [ ] 6.4 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the packages whose settings surface changed).
- [ ] 6.5 **Human-only, cannot be completed by an implementing agent**:
  open the Harness Settings surface and confirm `git` shows no agent
  picker, and that a configuration that set one still loads with a
  warning rather than failing.
