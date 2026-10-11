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
- [x] 4.3 Run `openspec validate terminal-parity-with-the-workbench --strict`
  and map every spec scenario to the concrete test that verified it.
  Strict validation passed. Per-scenario evidence is listed below. The targeted
  `reads actual blockers and open questions without changing their files` test
  passed 1/1 on 2026-10-11 (23 other tests intentionally skipped), closing the
  real blocker/question reader coverage gap without a production-code change.

### Scenario Evidence

Report tests below are in `packages/cli/src/report-commands.test.ts`; operator
tests are in `packages/cli/src/operator-commands.test.ts`. Core coverage is
subject to the full CI gate in task 4.2; no new local full-suite run is claimed.

| Spec scenario | Concrete evidence | Remaining limit |
| --- | --- | --- |
| Active changes exist only in their own worktrees | Report: lists a real active change from its own worktree with task totals | Fixture also has the checkout copy; core workspace discovery needs CI coverage |
| A task requires a person or declared delegate | Report: reads actual task responsibility and evidence from checkout fallback; preserves delegated task ownership from the change's own worktree | Own-worktree precedence also covered by core own-worktree-tasks tests |
| A change waits on a blocker or question | Report: reads actual blockers and open questions without changing their files; reads actual explanation roles and task progress without changing files; returns explanation facts and next actions as parseable JSON | Actual blocker/question data and read-only behavior verified; full CI remains task 4.2 |
| Change overrides differ from defaults | Report: uses the owning change's harness override | None for tested override |
| Configuration is invalid or terminal-incompatible | Report: resolves defaults and refuses invalid change configuration; refuses the host-only VS Code Chat target for a delegated terminal task | None for tested refusals |
| Agents are listed | Report: lists every registered provider without claiming login | No binary detection or authentication claimed |
| A message code is known or unknown | Report: explains a known message with template and remedy; refuses unknown messages with clean stdout | Registry currently has no retired entry |
| A known run's output was pruned | Report: reads retained run output and records pruned-output absence | None |
| A requested run is unknown | Report: reads retained run output and records pruned-output absence; returns records only for the requested run id | Packed unknown-run exit 1 also observed |
| A change has measured and unmeasured runs across worktrees | Report: uses core aggregation to count a measured run once and retain credit units; aggregates recorded change spend from a real sibling worktree | Covered by complementary fixtures |
| A change has no recorded runs | Report: reports zero recorded runs without inventing free usage | None |
| Artifacts include staged and untracked edits | Report: includes staged and untracked artifacts but excludes implementation files | Test also asserts an unstaged artifact |
| The artifact diff is empty or truncated | Report: reports an empty and truncated artifact diff without inventing changes; core change-diff.test.ts | Formatter fixture plus core truncation algorithm; core run required in CI |
| A valid live target is addressed | Operator: writes a signed note accepted by the core receiver without claiming agent approval | Packed queued messageId is recorded in 4.4; receipt is not claimed |
| A message is blank or its target expired | Operator: refuses blank notes before resolving the target; refuses expired or unverified targets before loading a signing key | None |
| A delegated task records evidence and completes | Operator: honors the core delegated evidence result recorded; real packed Copilot run in 4.4 | Real artifact independently checked |
| A run ticks without evidence or leaves the item open | Operator: honors the core delegated evidence result still-open/reverted; core delegated-item-run tests | Actual gate algorithm checked in core CI |
| The task is human-only, not delegated or its worktree is busy | Operator: refuses an ordinary task before dispatch; core own-worktree-tasks tests | Human-only and busy/invalid integration coverage relies on core CI |
| A permission is unanswered or execution interrupted | Operator: answers an agent permission request with false and preserves the result code; cancels the active delegated runner on SIGINT and exits unsuccessfully | Real untrusted Copilot refusal recorded in 4.4 |
| An eligible restoration is confirmed | Operator: restores only after confirmation while holding and releasing the mutation lease; core recovery tests | CLI restoration service is injected; real core restore tested in CI |
| Confirmation is declined or no terminal can answer | Operator: refuses declined recovery without overriding protections; refuses rollback without a terminal before reading or writing | Packed redirected-stdin refusal recorded in 4.4 |
| Checkpoints are absent, incompatible or conflict with live work | Operator: uses real recovery eligibility to refuse an empty journal; does not restore when the recovery journal is incompatible; refuses conflict recovery; refuses rollback while a real live status record names the target worktree | Core restore-conflict implementation checked in CI |
| Required arguments are missing | additional-commands.test.ts: rejects missing subjects without running a command; main.test.ts argument cases | None for tested cases |
| A machine consumes new JSON output | additional-commands.test.ts: runs real known-message output with parseable stdout; report/operator JSON assertions and packed stream in 4.4 | None for tested cases |
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
