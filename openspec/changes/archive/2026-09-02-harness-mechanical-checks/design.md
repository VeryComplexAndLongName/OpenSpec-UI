## Context

See `proposal.md` and `docs/adr/0019-mechanical-task-checks.md`. Facts
read from the code:

- `CHAIN_STAGE_COMMAND` maps `propose`/`review`/`apply`/`verify` to a
  `CommandKind`; `archive` is deliberately absent, with a comment saying
  it is a mechanical operation.
- `HarnessStepAgents = Partial<Record<HarnessStage, HarnessStepAgent>>`,
  so `stepAgents` accepts every value of `HarnessStage` — `archive` and
  `git` included — purely because the type is generic over the stage
  union.
- `HARNESS_TEMPLATE_STAGES` (`commands.ts`) and `STAGES`
  (`HarnessSettingsView.tsx`) each list the stages a user is offered.
- `task-checklist.ts` owns `TASK_CHECKBOX_LINE_RE`, the one place that
  knows what a task line looks like.
- `prepareAgentContext` is "the only function permitted to turn
  change-file content into text visible to the agent", and the invariant
  it holds is that repository content is data, not instructions.

## Goals / Non-Goals

**Goals:**

- Let a task whose acceptance is an exit code be decided by that exit
  code.
- Stop offering an agent for a stage that never invokes one.
- Keep repository content out of the set of things the harness executes.

**Non-Goals:**

- Free-form commands in `tasks.md`.
- Mechanical checks for implementation tasks.
- Changing how a task without a check behaves.

## Decisions

### The check is a name from a registry, not a command line

A task names a check; the name resolves against a table in
`packages/core`. The repository file chooses from a fixed set and cannot
describe an argument vector.

**Rejected alternative**: free-form command strings, filtered by an
allowlist like `default-runners.ts`'s. Rejected — an allowlist is a
filter on a hazard that a registry simply does not have. The argv
allowlist exists because an *agent's* command line genuinely varies with
its model and flags; a check does not vary at all, so the same machinery
would buy nothing and would leave `tasks.md` describing something
executable. That crosses the boundary `prepareAgentContext` holds, and
this project has spent the week tightening rather than widening it.

**Rejected alternative**: a small expression language for parameters.
Rejected — every check in the initial registry takes either no parameter
or a repository-relative path. A path is validated the same way
`checkCwdSandbox` already validates one; anything richer invites the
free-form interface back through a side door.

### Checks run at the front of `verify`, and a failure skips its agent

**Rejected alternative**: run them after the verifying agent, as a
cross-check on its report. Rejected — it pays for a run that a compiler
error already invalidated, and it puts an agent's narrative in
competition with an exit code. Where they disagree the exit code is
right, so the narrative should not be bought.

**Rejected alternative**: their own chain stage. Rejected — `archive` is
already a stage that invokes no agent, and a second one fragments a chain
whose stages otherwise map to units of work. The front of `verify` is
where a reviewer would run them by hand anyway.

### A check's result is written to the checkbox, and nothing else may

Only the harness marks a checked task. An agent that reports a mechanical
task done does not cause it to be marked.

**Rejected alternative**: let the agent mark them as it does today, with
the checks as advice. Rejected — that is the current behavior, and its
unreliability is the reason for this change.

### `stepAgents` narrows; existing configurations are migrated

`stepAgents` stops accepting `archive`. A configuration file that already
sets it is read, its `archive` entry dropped with a warning, and the rest
honoured.

**Rejected alternative**: reject such a file. Rejected — this
repository's own `openspec/agent-harness.json` sets it, so rejecting
would break the workspace the change is developed in, and every other
workspace that copied the documented example. A setting that never did
anything must not become a setting that breaks everything.

**Rejected alternative**: leave it accepted and ignored. Rejected — that
is the defect being fixed. A configuration that presents itself as
effective and is not has cost this repository three separate
investigations this week.

## Risks / Trade-offs

- **[Risk]** A wrong check marks a task done falsely, which is worse than
  not marking it: a checkbox is evidence to whoever reads the change
  later. → **Mitigation**: the registry is small, named, and each entry
  is unit-tested against both outcomes. It is also far smaller than the
  set of things an agent could claim.
- **[Risk]** Tasks get written to fit the registry, reshaping what gets
  verified around what is easy to check. → **Mitigation**: the registry
  covers checks the Verification sections already contained; it is not a
  new vocabulary. A task that does not fit keeps its current form, and
  ADR 0019 records that acceptance-with-an-exception is not mechanical.
- **[Trade-off]** Two ways a task can be marked — by check and by agent.
  Accepted, and bounded: a task with a check is never marked by an agent,
  so the two never contend for the same task.

## Migration Plan

Additive for `tasks.md`: a task without a check is parsed and behaves
exactly as today. Narrowing for `stepAgents`: an `archive` entry is
dropped on read with a warning rather than failing the load, and this
repository's own configuration is updated in the same change.

## Open Questions

- The exact syntax a task uses to name its check. It must be
  unambiguous against `TASK_CHECKBOX_LINE_RE` and readable in a plain
  markdown view, and the tasks require both properties to be tested
  rather than assumed.
