# Design

## Decisions

**Which agents are present is asked of the detection this repository
already has.** `detectAvailableAgentsDetailed`
(`packages/core/src/agent-detection.ts`) probes every id in
`AGENT_REGISTRY` through the default allowlist and reports presence and,
for a CLI agent, the version its own `--version` gave. The REST route,
the VS Code bridge and `webui`'s agent picker all read it.
`readEnvironmentReport` calls that, and turns what it returns into
findings.

Corrected on 2026-09-12, before implementation: this proposal first said
a binary must be resolved and never executed, on the grounds that a
version probe is an invocation nobody allowlisted. That argument reads
well and the decision was wrong — not because the reasoning is bad, but
because the question is already answered in this repository, by code
several surfaces depend on. A second implementation that answered
"is this agent here" differently from the picker in the same build is
exactly the drift this proposal objects to one decision further down,
about the preflight. If the probe is the wrong mechanism, that is a
change to `agent-detection.ts` and to every surface reading it, not a
quiet second opinion inside a new command.

**For a named change, the answer is the preflight's own.**
`--change <id>` calls `resolveChainStart` with the same resolver the CLI
builds for a run and prints its `ChainStartRefusal` — reason and
`configKey` — rather than re-deriving those conditions. A second
implementation of "may this change start" would drift from the first,
and the drift would show up as a doctor that says yes to a run that is
then refused.

**Exit codes follow the CLI's existing contract.** `0` nothing found
would stop a run; `1` something would — the same code `run`, `check` and
`ready` use for "the thing you asked about did not pass"; `2` the report
itself could not be produced. A workspace held by a live run is **not**
a failure: it is a fact, reported, and the workspace is not broken.

Rejected: exiting non-zero for a held workspace. `lease` decided this
already — the question was answered either way — and two commands
disagreeing about whether being busy is a failure is worse than either
answer.

**Findings are a closed list, each with a remedy or nothing.** A finding
is `{ id, severity, statement, remedy? }`, `severity` one of `stops-a-run`
or `worth-knowing`. A missing `openspec` CLI stops a run; no git
identity configured is worth knowing (a lease taken without one is
valid, as `a-lease-says-who` established). Nothing is reported without a
severity, and nothing carries a remedy that is not a command this
repository has.

**No new report of the workspace lease.** Who holds it is read with
`readWorkspaceLeaseHolder` — the reader that never takes it — and shown
the way `lease` shows it.

## Non-Goals

- Installing, configuring, or repairing anything.
- Network or authentication checks.
- Agent version detection.
- A UI surface. Both hosts refuse a run with a reason already; whether
  they should carry this report is a separate question and a separate
  change.
- Reading or printing any environment variable's value.

## Risks / Trade-offs

**A report that says everything is fine, and a run then fails.** The
mitigation is the decision above: for a named change the report *is* the
preflight, so the two cannot disagree about that change. Without
`--change`, the report is explicitly about the machine and the
workspace, and says so — it does not claim any particular change will
run.

**A check nobody updates.** Every agent checked comes from
`AGENT_REGISTRY`, so an agent added later is covered without a second
list; the test asserts the report covers exactly the registry's
executables, which fails when a new agent is added and the report is
not.

**Protocol impact: none.** No command or event is added or changed; this
is a CLI command over existing core reads. `server` and `extension` are
untouched.
