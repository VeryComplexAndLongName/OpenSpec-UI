# ADR 0019: Mechanical task checks

Status: Accepted

Date: 2026-09-02

## Context

Roughly a fifth of every `tasks.md` written in this repository is a
command whose result is an exit code. A representative Verification
section:

```
- [ ] 6.1 `openspec change validate --strict <id>`.
- [ ] 6.2 `npm run typecheck` and `npm run test` — green.
- [ ] 6.3 `git diff packages/core/src/checkpoint.ts` is empty.
- [ ] 6.4 Version bump via `npx changeset`.
```

An implementing agent is paid to type those, read their output, and set a
checkbox. Nothing about that requires a language model.

It also inherits a weakness this project has measured repeatedly. Marking
a task is the agent's own action, not a mechanism: `rules.tasks` requires
incremental marking, the rule demonstrably reaches the agent
(`harness-prompt-project-rules`), and compliance still varies run to run —
observed marking one or two at a time on some runs and in a single batch
on others. For a task whose acceptance is an exit code, the exit code can
decide, and the variance disappears for that class.

`archive` already works this way and is the existing precedent:
`harness-chain-runner.ts`'s own comment reads *"`archive` has none: it is
a mechanical operation (`archiveChange`), not a CLI-agent invocation"*,
and `CHAIN_STAGE_COMMAND` omits it. Yet
`openspec/agent-harness.json` configures `"archive": { "agent":
"claude-cli", "model": "claude-haiku-4.5" }`, `HarnessSettingsView`
offers an agent picker for it, and none of it does anything. A setting
that presents itself as effective and is not belongs to the same family
of defects this repository has been clearing all week —
`commandInstruction("review")` describing an implementation that does not
exist yet, `AiPanel`'s header promising a cancel control it did not have,
"Cancel Process" cancelling a different kind of process.

## Decision

### A task may name a check from a closed registry, never a command line

A task declares a **named** check with parameters. The name resolves
against a registry in `packages/core`; the file selects from a fixed set,
it does not supply an argument vector.

The initial registry covers what the recurring Verification sections
actually contain: validating the change, typecheck, tests, lint, "this
path is unchanged", and "a changeset exists for this change".

### The harness runs those checks and marks them by exit code

A named check's result sets its task's checkbox. Success marks it;
failure leaves it unchecked and reports which check failed. No agent is
invoked for it, and no agent's account of it is accepted in its place.

### Mechanical checks run at the start of `verify`, before its agent

They run first, and if any fails the verifying agent is not invoked at
all. Asking a model to review work that does not typecheck spends a run
to learn what a compiler already said.

Their results are put into the verifying agent's prompt, so it knows what
has already been established and does not repeat it.

### A task whose acceptance carries an exception is not mechanical

`npm run test — green, except the documented sprint-report and
change-timeline flakes` is not an exit code. Such a task keeps its
current form and its current owner. The registry is for checks that
either pass or fail, with nothing to interpret.

### `archive` stops offering an agent it never uses

The stage stays mechanical. The configuration schema and both settings
surfaces stop presenting an agent and model for it.

## Rejected Alternatives

**Free-form command strings in `tasks.md`, admitted by an allowlist.**
Rejected. It would make the harness execute text from a repository file,
which is the boundary `prepareAgentContext` exists to hold — *"repository
file contents as data, not executable instructions"*. An allowlist over
free text is a filter on that hazard; a named registry removes it, and
for this set of checks costs no expressiveness at all.

**A separate `checks.yaml` per change.** Rejected — a check belongs
beside the claim it verifies. Split across two files they drift, and the
task text stops being the whole statement of what "done" means.

**A dedicated chain stage for mechanical checks.** Rejected — `archive`
is already a stage that invokes no agent, and a second one fragments a
chain whose stages otherwise correspond to units of work. Folding the
checks into the front of `verify` keeps the sequence meaningful.

**Letting the agent run them as well, as a cross-check.** Rejected — it
pays for the work twice and makes the agent's narrative compete with an
exit code for authority. Where the two disagree the exit code is right,
so the narrative should not be collected.

**Extending this to `apply`'s tasks generally.** Rejected for now:
implementation tasks are not exit codes, and a registry that grew to
cover them would become the free-form command interface rejected above.

## Consequences

- `tasks.md` gains an optional, named check per task; tasks without one
  behave exactly as today.
- A class of tasks stops depending on an agent's willingness to mark
  incrementally, because nothing about them is the agent's judgement.
- A failing mechanical check saves an agent run rather than costing one.
- `openspec/agent-harness.json` no longer accepts a `stepAgents.archive`
  entry, and existing files carrying one need a migration path that does
  not simply reject them.
- Related OpenSpec change: `openspec/changes/harness-mechanical-checks/`.
