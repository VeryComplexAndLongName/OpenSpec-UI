From ADR 0046, accepted by the owner on 2026-10-08: "the other groups move
in later changes, one or a few groups at a time, under the ratchet". The
first steps landed; this change moves the eight groups that remain, one
section each, under a widened ratchet.

## 1. The register and the ratchet

- [x] 1.1 `packages/core/src/message-register.ts`: add the entries of the
  eight groups `HRN`, `AGT`, `TSK`, `VAL`, `ARC`, `WSP`, `KEY` and `NET`,
  each with its level, words with `{name}` values, `why` and `todo`. Keep
  every word a message already has; nothing is reworded. The register is a
  leaf with no imports, as before.
- [x] 1.2 `packages/core/src/message-register.test.ts`: widen `SAID_IN_PLACE`
  so `countUnregistered` counts the carriers the first ratchet did not - a
  literal `message:`/`problem:` field, a `refused(...)` reason literal, a
  `describe*` formatter's sentence, and a refusal error class's message
  literal - in one commit that re-baselines `UNREGISTERED_MESSAGES` to the
  new, larger count and records why in the test's comment (as it recorded
  323 to 290).
- [x] 1.3 `packages/core/src/message-register.test.ts`: add the
  already-existing `GIVEN` identifiers of the eight new groups, and a test
  that every group in `MESSAGE_GROUPS` has at least one entry, so a group
  left empty fails the test rather than going unnoticed.
- [x] 1.4 `packages/core/src/message-register.test.ts`: `npm run messages
  --workspace @openspec-ui/core` writes `docs/messages.md`, and the page
  test still passes (out of date? run the generator).

## 2. HRN - harness settings

- [x] 2.1 `packages/core/src/harness-config.ts`: every
  `InvalidHarnessConfigError` is thrown with a `code` from the register, and
  its message text is the register's words. Callers that read `.message`
  keep working; the new `code` field is additive.
- [x] 2.2 `packages/core/src/harness-config-findings.ts`: every
  `HarnessFinding.message` is the register's text and carries its `code`
  beside it.
- [x] 2.3 `packages/core/src/chain-preflight.ts`: the chain-start refusals
  whose `configKey` names a harness setting say their `reason` by
  identifier, the `code` riding beside the `reason`.
- [x] 2.4 `packages/core/src/supervisor.ts`: `fallbackRefusal` and
  `superviseFailure` say their reasons by identifier.

## 3. AGT - agents and adapters

- [x] 3.1 `packages/core/src/failure-diagnosis.ts`: `CAUSE_WORDS`,
  `REPEAT_WORDS` and the remedies are re-keyed by register identifier; the
  words stay, and the diagnosis carries `code` beside the sentence.
- [x] 3.2 `packages/core/src/agent-status.ts`: `REFUSAL_WORDS` and
  `MESSAGE_REFUSAL_WORDS` map an identifier to the words, and the status
  carries `code`.
- [x] 3.3 `packages/core/src/agent-roster.ts`: the malformed-roster reasons
  say by identifier.
- [x] 3.4 `packages/core/src/agents/acp-session-driver.ts`: the
  `agent refused the prompt` reason says by identifier.
- [x] 3.5 `packages/core/src/harness-chain-runner.ts`: the
  `no agent available to run the ... stage` `failedEvent(...)` line says by
  identifier. The `chain-preflight.ts` "no runner for this agent" refusal
  (2.3's file) says by identifier too.

## 4. TSK - tasks

- [x] 4.1 `packages/core/src/delegated-item-run.ts`: `refused(reason)`
  returns `{ status, reason, code, message }`, every reason said by
  identifier, and `message` stays `No run was started: <reason>.`.
- [x] 4.2 `packages/core/src/human-only-inbox-view.ts`: the `describe*`
  formatters (`describeHumanOnlyInbox`, `describeWaitingOn`,
  `describeUnmatchedTaskAgent`, `describeHumanOnlyInboxState`,
  `describeUnreadable`, `describeEnrolments`, `describeQuestions`,
  `describeUnmatched`) return a `SaidMessage` `{ code, text }`, and their
  callers render the `code`.
- [x] 4.3 `packages/core/src/task-checklist.ts`: `describeTaskDebts` returns
  a `SaidMessage`; `delegated-items.ts` is data plumbing and needs no
  change.
- [x] 4.4 `packages/core/src/harness-chain-runner.ts`: the `a request to
  stop after ... named a task this change does not have` line says by
  identifier.

## 5. VAL - validation, the merge gate, checks

- [x] 5.1 `packages/core/src/mechanical-checks.ts`: every check result's
  `reason` says by identifier, the `code` beside the words.
- [x] 5.2 `packages/core/src/spec-delta-check.ts` and
  `packages/core/src/successor-check.ts`: the drift and successor reasons
  say by identifier.
- [x] 5.3 `packages/core/src/change-relations-file.ts`: the relation-edit
  refusals' `message` says by identifier.
- [x] 5.4 `packages/core/src/verify-quality.ts`: `describeVerifyQuality`
  returns a `SaidMessage`; `harness-chain-runner.ts`'s `mechanical checks
  failed, verifying agent was not invoked` `failedEvent(...)` line says by
  identifier.

## 6. ARC - archiving

- [x] 6.1 `packages/core/src/openspec.ts`: `archiveChange`'s gate and
  `describeArchiveRefusal` say by identifier; the `could not archive ...`
  error carries `code`.
- [x] 6.2 `packages/core/src/landed-archive.ts`: `followArchivePullRequest`
  and `failureReason` say their refusals by identifier.

## 7. WSP - the workspace

- [x] 7.1 `packages/core/src/workspace-lease.ts`:
  `describeWorkspaceLeaseConflict` and `describeWorkspaceLeaseReclamation`
  return a `SaidMessage`.
- [x] 7.2 `packages/core/src/lease-release.ts`: the two refusal reasons say
  by identifier.
- [x] 7.3 `packages/core/src/workspace-leftovers.ts`: the removal reasons
  and `withHolders` sentences say by identifier.
- [x] 7.4 `packages/core/src/worktree-survey.ts` and
  `packages/core/src/change-worktrees.ts`: the `whyUnreadable` and worktree
  refusal reasons say by identifier.

## 8. KEY - signatures, keys, the team

- [x] 8.1 `packages/core/src/security.ts`: the allowlist and cwd-sandbox
  refusal reasons say by identifier.
- [x] 8.2 `packages/core/src/people.ts`: the `parsePersonFile` and
  `crossCheckPeople` problems say by identifier.
- [x] 8.3 `packages/core/src/enrolment.ts`: `EnrolmentRefusedError` carries
  `code`; `machine-key.ts`'s `the key at ... is not an Ed25519 key` says by
  identifier.

## 9. NET - network, proxy, the local LLM

- [x] 9.1 `packages/core/src/http-forges.ts`: `ForgeRefusal` carries `code`;
  the token and status reasons say by identifier.
- [x] 9.2 `packages/core/src/forge.ts`: the forge-detection reasons say by
  identifier.
- [x] 9.3 `packages/core/src/gh-pr-gateway.ts`: `gh is not signed in`, the
  pending and the check-state reasons say by identifier.
- [x] 9.4 `packages/core/src/agents/local-llm.ts` and the
  `failure-diagnosis.ts` network/local-LLM remedies: say by identifier.

## 10. Adapters surface the code

- [x] 10.1 `packages/cli/src/`: every adapter that re-says a core refusal
  as `openspec-ui-cli: <words>` prints the register's form instead -
  `answer-command.ts`, `task-command.ts`, `team-command.ts`,
  `lease-command.ts`, `status-command.ts`, `stop-command.ts`,
  `worktree-command.ts`, `run-change.ts`, `update-plan.ts`,
  `enrol-command.ts`, `history-command.ts`, `report-command.ts`.
- [x] 10.2 `packages/extension/src/`: every `showError/Warning/InformationMessage(...)`
  that re-says a core refusal leads with the identifier and drops the
  `OpenSpec Workbench: ` prefix - `commands.ts`, `extension.ts`,
  `change-elsewhere.ts`, `pipeline-panel.ts`, `run-controller.ts`,
  `webview/ai-panel.ts`.
- [x] 10.3 `packages/server/src/change-actions-rest.ts`: the `Refused`
  wrapper carries the identifier beside the text it already returns.

## 11. Documents

- [x] 11.1 `docs/messages.md`, regenerated by the core script; it lists the
  eight new groups with every identifier.
- [x] 11.2 `openspec/specs/messages/spec.md`: the stale `## Purpose` line
  ("created by archiving change every-message-has-an-identifier") is
  replaced with one sentence on what the capability is.
- [x] 11.3 A changeset (`npx changeset`): core, cli, extension, server,
  webui - minor.

## 12. Checks

- [x] 12.1 `npm run typecheck && npm run lint` and the affected packages'
  tests, with two workers: the register's, the ratchet's, and each moved
  message's own test, whose words are unchanged and whose code is asserted.
  2026-10-12: typecheck clean; lint 0 errors (4 unused-variable warnings,
  unrelated to identifiers); core 2298 passed, cli 285, extension 538,
  server 135, webui 768. The register's and the ratchet's tests pass;
  `UNREGISTERED_MESSAGES` holds 335.
- [x] 12.2 `openspec validate remaining-groups-move-into-the-register
  --strict`, and the merge gate with the worktree's absolute path as
  `--cwd`.
  2026-10-12: "Change 'remaining-groups-move-into-the-register' is valid";
  the merge gate (`validate changes --base origin/main`) reports "All
  changes valid", exit 0.
- [ ] 12.3 **Human-only**: in VS Code, on the extension built from this
  branch, a run that fails for one of the newly registered reasons shows
  `Failed:` with the identifier as a link, and the link opens its entry in
  `docs/messages.md`; the `openspec-ui-cli explain message <OSW-code>`
  command answers for one of the new codes.
