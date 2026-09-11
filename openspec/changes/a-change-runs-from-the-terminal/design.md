# Design

## Decision: the terminal is a thinner surface, not a more privileged one

The CLI resolves the change's harness configuration exactly as the two
UIs do, calls the same `resolveRunWithHarnessTarget`, and starts the same
`HarnessChainRunner`. Where the configuration says a run needs something
a terminal cannot supply, the CLI refuses and names the key that would
change that.

No flag lowers a gate. There is no `--autonomous`, no `--yes` that
answers a checkpoint, and no `--no-review`. This is the whole safety
argument for the change: a second entry point into the harness is only
acceptable while it is incapable of doing anything the first two could
not already be configured to do. A flag that bypassed a configured
checkpoint would make the CLI the way to get around the config, and the
config is where this product keeps its consent.

Concretely, per `autonomyLevel`:

- `assisted` — refused. There is no chain at this level; the UI opens a
  picker so a person can start one stage. A terminal has nothing to open
  and nothing to pre-fill, and inventing a fourth dispatch target for it
  would be a capability the UIs do not have.
- `semi-autonomous` — runs, and stops at each checkpoint. See the next
  decision.
- `autonomous` — runs through. Already reachable only from a per-change
  file that a person wrote by hand.

## Decision: a checkpoint is answered by a person or not at all

`semi-autonomous` means "pause between stages and ask". The CLI asks on
standard input, printing the same Continue/Cancel choice the panel shows,
and waits.

Where standard input is not a terminal — a CI runner, a cron job, a
process with its input closed — there is nobody to ask, and the run is
refused **before the first stage starts**, not at the first checkpoint.
Refusing late would mean the propose stage had already run, and a change
whose proposal was rewritten by a chain that then died at a checkpoint is
worse off than one that was never started.

The refusal names `checkpoints.requireConfirmationBetweenSteps` and says
that setting it to `false` in the change's own `harness.json` is what
makes this change runnable unattended. That is a real instruction a
person can act on, and it routes them through the file where the decision
belongs rather than through a flag.

A change whose configuration already sets that key to `false` is a chain
with no checkpoints, and runs unattended at `semi-autonomous` exactly as
it would in a UI.

## Decision: every refusal happens before anything is spent

The resolution order is: the change exists, its name is valid, its
configuration parses, its autonomy level permits a chain, its checkpoints
can be answered, the workspace lease is free, every stage's agent
resolves to a runner this build has. Only then does the first stage
start.

The last of those is worth stating separately. A chain whose `apply`
stage names an agent this build does not have fails at `apply` — after
`propose` and `review` have each spent a real agent invocation on a
change that was never going to finish. The CLI resolves every stage's
agent up front and refuses the whole run if one is missing, naming the
stage and the agent id. The UIs can afford to discover this late because
a person is watching and can fix it between stages; an unattended run
cannot.

## Decision: the exit codes keep ADR 0007's three meanings

`0` the chain completed. `1` the change failed — a stage failed, the
declared checks failed, or a person cancelled. `2` the CLI could not run
the chain at all.

Every refusal above is a `2`: nothing about the change was found to be
wrong, the tool declined to start. A cancelled run is a `1` rather than
its own code, because the three-code contract is the one CI systems in
this repository already branch on, and "did not complete" is the
actionable half of it. The reason is always printed, so a reader never
has to infer it from the code.

## Decision: text for a person, one JSON object per line for a machine

`validate` defaults to JSON because its output is one document produced
at the end. A run is a stream, so `run` defaults to `text`: stage
boundaries, the agent each stage used, agent output as it arrives, and a
closing summary.

`--format json` emits one JSON object per line — the protocol `Event`,
verbatim, as it is published. Not an array: an array cannot be written
until the run ends, and a CI log that shows nothing for nine minutes and
then everything is the failure mode this format exists to avoid. A
consumer reads it with a line-by-line parse, which is what every log
shipper already does.

Text rendering reuses the fold the panel uses (`readAcpStreamedText`
through the same rule `collapseStreamEvents` applies), because an ACP
agent's reply arrives in slices there too and a terminal has the same
reason not to show them.

## Decision: the run takes the cross-host lease, as a third kind of host

ADR 0010's lease exists so two hosts cannot mutate one workspace at once.
A terminal run mutates a workspace exactly as the other two do, so it
takes the lease, and `WorkspaceLeaseHostKind` gains `"cli"`.

`hostKindLabel` is today a ternary, so a third kind would be reported to
a user as "standalone server". It becomes exhaustive. An older installed
build reading a `"cli"` lease will still mislabel it — that cannot be
fixed from here — but it will correctly see the workspace as held, which
is the part that matters.

The renew-and-release dance lives in core as a scope-bound helper the CLI
calls, not copied into the adapter. `WorkbenchProcessScheduler` keeps its
own inline version: it releases and re-acquires the lease across
suspension and resume, which a helper bound to one scope cannot express.
Two callers with genuinely different lifetimes, not a duplication.

## Decision: `check` runs declared checks, and only those

`openspec-ui-cli check <change>` runs the mechanical checks that change's
`tasks.md` declares, through `runMechanicalCheck`, and reports each one's
name and reason. No agent is resolved and nothing is spent.

A change that declares no checks is reported as declaring none, and exits
`0`. That is not a pass dressed up as one — the report says which checks
ran, and zero of them is a visible answer. Exiting `1` would call a
change broken for a state most changes in this repository's history were
in.

This is the answer to "run Lint and Tests" that does not create a second
spelling of `npm run lint`. The check names are a closed registry core
owns (ADR 0019); the CLI selects nothing and invents nothing.

## Decision: an interrupt cancels the chain rather than abandoning it

`SIGINT` calls `HarnessChainRunner.cancel`, which terminates the spawned
process tree and releases the lease through the helper's scope exit. A
second `SIGINT` exits immediately, because a person pressing it twice has
decided not to wait, and a shell that ignores Ctrl-C is worse than a
leaked child process.

Without this, Ctrl-C would leave a running agent CLI parented to nothing
and a lease file that no longer has a holder, which the next run would
have to wait twenty seconds to reclaim.

## Non-Goals

Running several changes at once, a daemon, a watch mode, or any command
that writes to a repository outside the chain. The CLI gains one way to
start the harness and one way to run a change's checks.

## Risks / Trade-offs

The CLI's bundle grows: it now pulls in the agent adapters, the chain
runner and the security layer rather than the OpenSpec wrapper alone.
That is the cost of the adapter being thin — the alternative is logic in
the CLI, which ADR 0001 forbids.

A terminal run can spend money, which no previous CLI command could. The
budget ceilings in `harness.json` apply unchanged, because they are
enforced inside the chain runner, and the audit log the ceilings read is
the same file the UIs write. A run started here is visible in the
Processes view and counted against the same totals.

Refusing before the first stage costs a configuration read that the UIs
do lazily. It is one file per stage at most, already cached by the
resolver, against the alternative of paying for two agent invocations to
discover the third is unavailable.
