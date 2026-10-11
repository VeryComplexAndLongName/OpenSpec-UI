# Tasks

## 1. Reports

- [x] 1.1 In `packages/cli/src/changes-command.ts`, implement `showChangesCommand`
  using core worktree-aware listing, stages and readiness; return stage, task
  totals, blockers and source path without mutating files.
- [x] 1.2 In `packages/cli/src/report-commands.test.ts` and core worktree tests,
  verify active worktree listing, blockers, empty workspace and JSON/text output.
- [x] 1.3 In `packages/cli/src/task-command.ts`, add `showTasksCommand` using
  `readChangeTaskRows`; retain number, section, text, body, done, closedBy and agent.
- [x] 1.4 In `packages/cli/src/task-command.test.ts`, verify own-worktree precedence,
  checkout fallback, human/delegate markers and invalid-directory refusal.
- [x] 1.5 In `packages/cli/src/diff-command.ts`, implement `showDiffCommand`
  with core `readChangeDiff` at the resolved root and explicit artifact-only scope.
- [x] 1.6 In `packages/cli/src/diff-command.test.ts`, verify staged/unstaged/untracked
  artifacts, empty/truncated diff and no claim to include implementation files.
- [x] 1.7 In `packages/cli/src/harness-command.ts`, implement `explainHarnessCommand`
  using effective core config, with declared steps, agents/models, gates and units.
- [x] 1.8 In `packages/cli/src/report-commands.test.ts` and core harness tests,
  verify overrides/defaults, owning root, non-USD budgets, unsupported terminal
  agents and invalid config failure.
- [x] 1.9 In `packages/cli/src/agents-command.ts`, implement `showAgentsCommand`
  from core registry/provider/capability facts; do not infer login state.
- [x] 1.10 In `packages/cli/src/agents-command.test.ts`, cover every registry entry
  and distinguish terminal support from registration without spawning agents.
- [x] 1.11 In `packages/cli/src/message-command.ts`, implement `explainMessageCommand`
  from `MESSAGES`, including placeholders, retired status, why/todo and docs URL.
- [x] 1.12 In `packages/cli/src/message-command.test.ts`, cover known/unknown codes,
  template rendering and retired behavior when a retired entry exists; no guessed ids.
- [x] 1.13 In `packages/cli/src/cost-command.ts`, implement `showCostCommand` by
  filtering repository-wide change records and invoking `buildUsageReport`.
- [x] 1.14 In `packages/cli/src/report-commands.test.ts`, verify worktree-spanning
  spend, runId deduplication, credits kept separate, missing usage and empty reports.
- [x] 1.15 In `packages/cli/src/show-run-command.ts`, implement `showRunCommand`
  joining audit/retained logs by runId, with ordered output and missing/truncated facts.
- [x] 1.16 In `packages/cli/src/show-run-command.test.ts`, verify known/unknown runs,
  pruned output, other-run exclusion and runId/instanceId distinction.
- [x] 1.17 In `packages/cli/src/explain-change-command.ts`, implement
  `explainChangeCommand` from core stage/history/readiness/task/question readers.
- [x] 1.18 In `packages/cli/src/report-commands.test.ts`, verify factual
  owner/implementer, progress, blockers/questions and evidence-backed next actions.

## 2. Operator Actions

- [x] 2.1 In `packages/cli/src/send-message-command.ts`, implement
  `sendMessageCommand` with core live-status resolution and signed note delivery.
  Respect author policy; report queued messageId, not successful receipt.
- [x] 2.2 In `packages/cli/src/send-message-command.test.ts`, verify receiver
  acceptance via core, sender signature/author, blank text and expired/unknown target.
- [x] 2.3 In `packages/cli/src/task-command.ts`, implement `runTaskCommand` using
  the existing own-worktree delegated-run wrapper, number-to-line mapping,
  declared delegate, correct-root runners/audit and streamed events.
- [x] 2.4 In `packages/cli/src/operator-commands.test.ts` and core delegated-task
  tests, verify exactly one item runs, ordinary/human tasks are refused, busy or
  invalid worktrees are refused, permission allow/deny and SIGINT cancellation
  are handled, evidence gates apply, and failure/cancellation exit 1.
- [x] 2.5 In `packages/cli/src/rollback-command.ts`, implement `rollbackCommand`
  through core recovery and mutation lease, with consequence prompt and no bypass.
- [x] 2.6 In `packages/cli/src/rollback-command.test.ts`, verify eligible restore,
  absent checkpoints, live writer, conflict, incompatible journal, declined
  confirmation and non-TTY leaving every file unchanged.

## 3. Public Contract

- [x] 3.1 In `packages/cli/src/subcommands.ts`, add exactly the twelve pairs
  listed in proposal.md; preserve existing routes and former-name refusals.
- [x] 3.2 In `packages/cli/src/subcommands.test.ts`, verify all new pairs route
  and satisfy `readActionTitle`; current names and aliases remain unchanged.
- [x] 3.3 In `packages/cli/src/main.ts`, wire all handlers, argument validation,
  cwd/formats and interruption without shell interpolation or coercing permissions.
- [x] 3.4 In `packages/cli/src/main.test.ts`, verify each route reaches its
  handler with correct ids, roots and format, missing arguments/invalid formats
  exit 2, no confirmation bypass, JSON stdout free of diagnostics.
- [x] 3.5 In `packages/core/src/message-register.ts`, register new argument and
  refusal diagnostics using available identifiers; never reassign an existing code.
- [x] 3.6 Regenerate `docs/messages.md` through the core message generator and
  verify it exactly matches the register; do not hand-edit generated text.
- [x] 3.7 In `packages/core/src/message-register.test.ts`, verify each newly
  added identifier and the existing generated-document invariant.
- [x] 3.8 In `packages/cli/README.md`, document all twelve commands, exit/format
  contracts, audit limits, ids, artifact-diff scope and actual permission rules;
  remove obsolete validate-only descriptions and former-command examples.
- [x] 3.9 Add `.changeset/terminal-parity-with-the-workbench.md` with CLI minor
  and core minor when public messages/APIs change; do not edit package versions.

## 4. Verification
- [x] 4.1 Run focused handler tests after each slice; record commands/counts
  here. Use core's existing recovery/message/delegation/security regression tests
  where those paths are reused. No scenario closes from a routing test alone.
  Verification record, Node 24.21.0/npm 10.9.0: focused CLI route/main/task files
  passed 55/55; latest `report-commands.test.ts` passed 22/22 and
  `operator-commands.test.ts` passed 21/21; core message-register/own-worktree
  tests passed 21/21. CLI typecheck, lint, build, pack dry-run, changeset lint,
  generated-message invariant and strict OpenSpec validation passed.
  The targeted `reads actual explanation roles and task progress without
  changing files` test passed 1/1 after fixing advice derivation through core
  `buildHints`; the other 22 report tests were deliberately skipped in that run.
- [ ] 4.2 Run pinned-runtime root `npm run typecheck`, `npm run lint` and
  `npm run test` unpiped; record package counts and real failures, no guessed success.
  Full workspace checks have not been run locally; the full CI gate remains required.
- [ ] 4.3 Run `openspec validate terminal-parity-with-the-workbench --strict`
  and map every spec scenario to the concrete test that verified it.
  Strict validation passed. Complete per-scenario mapping remains to be reviewed;
  the prior grouped mapping was insufficient. Available coverage: change/task/harness/agents/messages/cost/run/diff/
  explanation reports — `report-commands.test.ts` plus core change/readiness,
  harness, message and worktree tests; signed notes, task permission/evidence/
  cancellation and rollback protections — `operator-commands.test.ts` plus core
  delegation/recovery tests; command vocabulary, arguments, stdout and JSON —
  `additional-commands.test.ts`, `main.test.ts` and `subcommands.test.ts`.
- [x] 4.4 **Completed by owner-authorized verification, including a real copilot-cli run.** Build/pack `packages/cli`, install into
  an isolated consumer and exercise all twelve pairs against temporary git/OpenSpec
  fixtures. Record exact commands, exit codes, JSON/event parsing, messageId and
  delegated run audit/evidence lines. Do not mutate production repositories.
  Verified on 2026-10-11 in temporary consumer
  `openspec-cli-consumer-full-c1d98b9b61934c3cbc50758ce79b10f8` and fixture
  `openspec-cli-smoke-d818946ab4d546ca84ff7f0c874ca624` under the system temp directory.
  Commands: `npm run build --workspace @openspec-ui/cli`,
  `npm pack --workspace @openspec-ui/cli --pack-destination <consumer>/packs`,
  then `npm install --offline --ignore-scripts <cli-tarball> <local-sdk-tarball>`.
  The locally packed installed SDK 1.7.0 was needed because offline registry
  metadata was stale. No registry publication occurred.
  Installed `node <consumer>/node_modules/@openspec-ui/cli/dist/cli.js`:
  show changes/tasks/diff/agents/cost, explain change-harness/message/change
  returned exit 0 and parseable JSON against `--cwd <fixture>/repo --format json`.
  `show run d9adfc44-1cbf-46a5-9f6a-5e3aa31e4cec` returned exit 0 and one retained log;
  unknown run and expired message returned exit 1.
  `send message smoke-live-instance-2 "Consumer smoke message"` returned exit 0,
  author `run`, status `queued`, messageId `9bf0983f-95e6-41b6-aafe-ef22b99fe962`.
  `rollback change smoke-change` with explicitly redirected stdin returned exit 1,
  empty stdout and OSW-CLI-017 on stderr; it did not restore files.
  `run task smoke-change 1.1` through installed Copilot CLI 1.0.95 returned exit 0,
  JSON events and gate `recorded`, runId `d9adfc44-1cbf-46a5-9f6a-5e3aa31e4cec`.
  Audit records contain started/completed, taskNumber 1.1 and the fixture worktree cwd.
  Independently read `smoke-result.txt`: exactly `consumer-smoke-ok`; tasks.md
  contains the tick and indented evidence. This run used temporary workspace trust
  and a 30-credit cap (reported 5.19 credits). The earlier untrusted run refused
  writes and correctly left the item open. Copilot performed the delegated task;
  the host assistant checked the remaining packaged commands, not a separate
  Copilot review of all twelve pairs.
- [x] 4.5 **Human-only, completed by owner delegation.** At the owner's explicit
  request on 2026-10-11, reviewed the rollback prompt and CLI descriptions. The
  prompt says eligible checkpoints restore prior contents and update the journal;
  README distinguishes runId/instanceId, recorded versus unmeasured usage and
  artifact-only diff. No live rollback was performed.
