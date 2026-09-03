## Why

Raised directly in a repository conversation on 2026-09-02: tasks that
amount to calling a program should be a call, not an agent run. The
decision is `docs/adr/0019-mechanical-task-checks.md`.

About a fifth of every `tasks.md` in this repository is exactly that. A
representative Verification section asks for `openspec change validate
--strict <id>`, `npm run typecheck`, `npm run test`, `git diff <path>`
being empty, and a changeset existing. An implementing agent is paid to
type those, read their output, and set a checkbox.

It also inherits a weakness measured repeatedly here. Marking a task is
the agent's own action, not a mechanism: `rules.tasks` requires
incremental marking, `harness-prompt-project-rules` proved the rule
reaches the agent, and compliance still varies — one or two at a time on
some runs, a single batch on others. Where acceptance is an exit code,
the exit code can decide.

The example given was archiving, and it turns out to be already done:
`harness-chain-runner.ts` states *"`archive` has none: it is a mechanical
operation (`archiveChange`), not a CLI-agent invocation"*, and
`CHAIN_STAGE_COMMAND` omits it. But the configuration disagrees.
`openspec/agent-harness.json` carries `"archive": { "agent":
"claude-cli", "model": "claude-haiku-4.5" }`, `HarnessSettingsView` lists
`archive` among the stages with an agent picker, and none of it has any
effect. That is the same defect this repository has cleared three times
this week: `commandInstruction("review")` describing an implementation
that does not exist yet, `AiPanel`'s header promising a cancel control it
did not have, and a command titled "Cancel Process" that cancelled a
different kind of process.

## What Changes

- New `packages/core/src/mechanical-checks.ts`: a closed registry of
  named checks — validate, typecheck, test, lint, "this path is
  unchanged", "a changeset exists for this change" — each a function, not
  a command string.
- `packages/core/src/task-checklist.ts`: a task may carry a named check
  and its parameters; a task without one is unchanged.
- `packages/core/src/harness-chain-runner.ts`: the `verify` stage runs
  the mechanical checks first, marks their tasks by result, and skips
  invoking its agent entirely if any failed. Passing results are put into
  the agent's prompt so it does not repeat them.
- `packages/core/src/harness-config.ts`, `harness-step-agent.ts`:
  `stepAgents` stops accepting `archive`. Existing configurations that
  set it are migrated rather than rejected.
- `packages/webui/src/components/HarnessSettingsView.tsx` and the
  extension's equivalent: `archive` no longer offers an agent or model.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness`)

### Modified Capabilities

- `agentic-harness`: a task may declare a mechanical check, which the
  system performs and records itself; a stage that invokes no agent no
  longer offers one to configure.

## Impact

- `packages/core`: one new module, plus `task-checklist.ts`,
  `harness-chain-runner.ts`, `harness-config.ts`, `harness-step-agent.ts`.
- `packages/webui`, `packages/extension`: the harness settings surface.
- `openspec/agent-harness.json` in this repository sets
  `stepAgents.archive` today and will be migrated by the change.
- No change to the command or event protocol, to any adapter, or to how
  a task without a check behaves.

## Explicitly out of scope

- Free-form commands in `tasks.md`. ADR 0019 rejects them: the harness
  must not execute text from a repository file, which is the boundary
  `prepareAgentContext` exists to hold.
- Mechanical checks for implementation tasks. Those are not exit codes,
  and a registry grown to cover them becomes the free-form interface just
  rejected.
- Tasks whose acceptance carries an exception — `npm run test — green,
  except the documented flakes` is not an exit code and keeps its current
  owner.
- Removing the `git` stage's configurability. It is unimplemented
  (ADR 0014), not mechanical.
