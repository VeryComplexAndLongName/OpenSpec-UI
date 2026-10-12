# Proposal

## Why

ADR 0046, accepted by the owner on 2026-10-08, decides that every message
the product says to a person is said as `<level> OSW-<GROUP>-<NNN>:
<message>`, from one register in core, and that the register comes first
with a few groups while "the other groups move in later changes, one or a
few groups at a time, under the ratchet". The first steps landed: `CLI`,
`RUN`, `QST` and `PRM`, then `CHG`, `GIT` and `PRC`. The eight remaining
groups - `HRN`, `AGT`, `TSK`, `VAL`, `ARC`, `WSP`, `KEY` and `NET` - are
still said in place, as sentences written where they are said. A person
still cannot look up most of what the product tells them, and the ratchet as
written counts only four of the forms that carry those sentences, so
finishing the job cannot even be measured.

## What Changes

- `message-register.ts` in core: entries for the eight remaining groups,
  every message's identifier, level, words with named values, why it is said
  and what to do.
- The remaining carriers are taught to say by identifier rather than as a
  sentence written in place: the `reason:` fields of the checks, the
  gateways and the refusals; the `refused(...)` helper and the `describe*`
  sentence formatters; the refusal error classes (`InvalidHarnessConfigError`,
  `ForgeRefusal`, `EnrolmentRefusedError`, and the CLI's/server's `Refused`
  and `ReportRefusal`); the `failedEvent(...)` and
  `showError/Warning/InformationMessage(...)` literals in the chain runner,
  the CLI, the server and the extension.
- The ratchet in `message-register.test.ts` generalizes from the four forms
  it counts today to every carrier above, re-baselines once (the held number
  rises because it now counts more forms), and from then on only falls as
  the groups move in, ending at the documented residual.
- `docs/messages.md`, regenerated; it gains the eight groups.
- Tests: the register's, the ratchet's, and the moved messages' own tests,
  which keep their words and gain the code.

## Capabilities

### New Capabilities

None. The register, `say`, the page and the ratchet already exist; what
changes is how much of what the product says is said through them.

### Modified Capabilities

- `messages`: the register holds all fourteen groups; every carrier that
  says a sentence carries its identifier; the ratchet counts every carrier
  and falls to the documented residual.

## Impact

- `packages/core`: `message-register.ts` and `message-register.test.ts`;
  `harness-config.ts`, `harness-config-findings.ts`, `chain-preflight.ts`,
  `supervisor.ts`, `failure-diagnosis.ts`, `agent-roster.ts`,
  `agent-status.ts`, `agents/acp-session-driver.ts`, `harness-chain-runner.ts`,
  `delegated-item-run.ts`, `human-only-inbox-view.ts`, `task-checklist.ts`,
  `mechanical-checks.ts`, `spec-delta-check.ts`, `successor-check.ts`,
  `change-relations-file.ts`, `verify-quality.ts`, `gh-pr-gateway.ts`,
  `openspec.ts`, `landed-archive.ts`, `workspace-lease.ts`,
  `lease-release.ts`, `workspace-leftovers.ts`, `worktree-survey.ts`,
  `change-worktrees.ts`, `security.ts`, `people.ts`, `enrolment.ts`,
  `machine-key.ts`, `http-forges.ts`, `forge.ts`, `agents/local-llm.ts`.
- `packages/cli`, `packages/extension`, `packages/server`: the adapters that
  re-say core's refusals, dropping their `openspec-ui-cli:` /
  `OpenSpec Workbench:` prefixes in favour of the identifier.
- `docs/messages.md`, `openspec/specs/messages/spec.md`.
