# Tasks

## 1. Reports

- [ ] 1.1 In `packages/cli/src/changes-command.ts`, implement `showChangesCommand`
  using core worktree-aware listing, stages and readiness; return stage, task
  totals, blockers and source path without mutating files.
- [ ] 1.2 In `packages/cli/src/changes-command.test.ts`, verify active changes in
  checkout and own worktrees, blockers, empty workspace and JSON/text output.
- [ ] 1.3 In `packages/cli/src/task-command.ts`, add `showTasksCommand` using
  `readChangeTaskRows`; retain number, section, text, body, done, closedBy and agent.
- [ ] 1.4 In `packages/cli/src/task-command.test.ts`, verify own-worktree precedence,
  checkout fallback, human/delegate markers and invalid-directory refusal.
- [ ] 1.5 In `packages/cli/src/diff-command.ts`, implement `showDiffCommand`
  with core `readChangeDiff` at the resolved root and explicit artifact-only scope.
- [ ] 1.6 In `packages/cli/src/diff-command.test.ts`, verify staged/unstaged/untracked
  artifacts, empty/truncated diff and no claim to include implementation files.
- [ ] 1.7 In `packages/cli/src/harness-command.ts`, implement `explainHarnessCommand`
  using effective core config, with declared steps, agents/models, gates and units.
- [ ] 1.8 In `packages/cli/src/harness-command.test.ts`, verify overrides/defaults,
  owning root, non-USD budgets, unsupported terminal agents and invalid config failure.
- [ ] 1.9 In `packages/cli/src/agents-command.ts`, implement `showAgentsCommand`
  from core registry/provider/capability facts; do not infer login state.
- [ ] 1.10 In `packages/cli/src/agents-command.test.ts`, cover every registry entry
  and distinguish terminal support from registration without spawning agents.
- [ ] 1.11 In `packages/cli/src/message-command.ts`, implement `explainMessageCommand`
  from `MESSAGES`, including placeholders, retired status, why/todo and docs URL.
- [ ] 1.12 In `packages/cli/src/message-command.test.ts`, cover known/unknown codes,
  template rendering and retired behavior when a retired entry exists; no guessed ids.
- [ ] 1.13 In `packages/cli/src/cost-command.ts`, implement `showCostCommand` by
  filtering repository-wide change records and invoking `buildUsageReport`.
- [ ] 1.14 In `packages/cli/src/cost-command.test.ts`, verify worktree-spanning
  spend, runId deduplication, credits kept separate, missing usage and empty reports.
- [ ] 1.15 In `packages/cli/src/show-run-command.ts`, implement `showRunCommand`
  joining audit/retained logs by runId, with ordered output and missing/truncated facts.
- [ ] 1.16 In `packages/cli/src/show-run-command.test.ts`, verify known/unknown runs,
  pruned output, other-run exclusion and runId/instanceId distinction.
- [ ] 1.17 In `packages/cli/src/explain-change-command.ts`, implement
  `explainChangeCommand` from core stage/history/readiness/task/question readers.
- [ ] 1.18 In `packages/cli/src/explain-change-command.test.ts`, verify factual
  owner/implementer, progress, blockers/questions and evidence-backed next actions.

## 2. Operator Actions

- [ ] 2.1 In `packages/cli/src/send-message-command.ts`, implement
  `sendMessageCommand` with core live-status resolution and signed note delivery.
  Respect author policy; report queued messageId, not successful receipt.
- [ ] 2.2 In `packages/cli/src/send-message-command.test.ts`, verify receiver
  acceptance via core, sender signature/author, blank text and expired/unknown target.
- [ ] 2.3 In `packages/cli/src/task-command.ts`, implement `runTaskCommand` using
  the existing own-worktree delegated-run wrapper, number-to-line mapping,
  declared delegate, correct-root runners/audit and streamed events.
- [ ] 2.4 In `packages/cli/src/task-command.test.ts`, verify exactly one item
  runs, human/ordinary tasks refused, busy/invalid worktree refused, permission
  and interrupt behavior, evidence gate, failure and cancellation exit 1.
- [ ] 2.5 In `packages/cli/src/rollback-command.ts`, implement `rollbackCommand`
  through core recovery and mutation lease, with consequence prompt and no bypass.
- [ ] 2.6 In `packages/cli/src/rollback-command.test.ts`, verify eligible restore,
  absent checkpoints, live writer, conflict, incompatible journal, declined
  confirmation and non-TTY leaving every file unchanged.

## 3. Public Contract

- [ ] 3.1 In `packages/cli/src/subcommands.ts`, add exactly the twelve pairs
  listed in proposal.md; preserve existing routes and former-name refusals.
- [ ] 3.2 In `packages/cli/src/subcommands.test.ts`, verify all new pairs route
  and satisfy `readActionTitle`; current names and aliases remain unchanged.
- [ ] 3.3 In `packages/cli/src/main.ts`, wire all handlers, argument validation,
  cwd/formats and interruption without shell interpolation or coercing permissions.
- [ ] 3.4 In `packages/cli/src/main.test.ts`, verify each route reaches its
  handler with correct ids, roots and format, missing arguments/invalid formats
  exit 2, no confirmation bypass, JSON stdout free of diagnostics.
- [ ] 3.5 In `packages/core/src/message-register.ts`, register new argument and
  refusal diagnostics using available identifiers; never reassign an existing code.
- [ ] 3.6 Regenerate `docs/messages.md` through the core message generator and
  verify it exactly matches the register; do not hand-edit generated text.
- [ ] 3.7 In `packages/core/src/message-register.test.ts`, verify each newly
  added identifier and the existing generated-document invariant.
- [ ] 3.8 In `packages/cli/README.md`, document all twelve commands, exit/format
  contracts, audit limits, ids, artifact-diff scope and actual permission rules;
  remove obsolete validate-only descriptions and former-command examples.
- [ ] 3.9 Add `.changeset/terminal-parity-with-the-workbench.md` with CLI minor
  and core minor when public messages/APIs change; do not edit package versions.

## 4. Verification

- [ ] 4.1 Run focused handler tests after each slice; record commands/counts
  here. Use core's existing recovery/message/delegation/security regression tests
  where those paths are reused. No scenario closes from a routing test alone.
- [ ] 4.2 Run pinned-runtime root `npm run typecheck`, `npm run lint` and
  `npm run test` unpiped; record package counts and real failures, no guessed success.
- [ ] 4.3 Run `openspec validate terminal-parity-with-the-workbench --strict`
  and map every spec scenario to the concrete test that verified it.
- [ ] 4.4 **Delegated to copilot-cli.** Build/pack `packages/cli`, install into
  an isolated consumer and exercise all twelve pairs against temporary git/OpenSpec
  fixtures. Record exact commands, exit codes, JSON/event parsing, messageId and
  delegated run audit/evidence lines. Do not mutate production repositories.
- [ ] 4.5 **Human-only.** Confirm rollback consequence/prompt is clear and report
  descriptions distinguish runId/instanceId, recorded/unmeasured spend and
  artifact-only diff. Record acceptance; leave open until a person confirms.
