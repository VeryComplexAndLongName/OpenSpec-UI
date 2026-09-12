# ci-cli Specification

## Purpose
TBD - created by archiving change ci-cli. Update Purpose after archive.
## Requirements
### Requirement: `validate` command checks every active change and aggregates the result

The CLI SHALL list every active OpenSpec change in the given workspace,
run strict validation on each, and print a single aggregated report
(`{ ok, results: [...] }` in JSON by default, an equivalent table with
`--format text`). `ok` SHALL be `true` if and only if every change's
`valid` field is `true`.

#### Scenario: All active changes are valid

- **WHEN** `validate` runs against a workspace where every active change
  passes strict validation
- **THEN** the process exits with code `0` and prints `ok: true` with one
  result entry per change

#### Scenario: At least one active change is invalid

- **WHEN** `validate` runs against a workspace where one or more active
  changes fail strict validation
- **THEN** the process exits with code `1`, `ok` is `false`, and the
  report still includes every change's result (not just the failing
  ones)

#### Scenario: A single change cannot be validated

- **WHEN** the underlying `openspec` CLI errors for one specific change
  (e.g. a corrupted change directory) while other changes list and
  validate normally
- **THEN** that change's result carries `valid: false` and an `error`
  message, the run still completes and reports every other change, and
  the process exits with code `1` (not `2`)

#### Scenario: The check itself cannot run

- **WHEN** listing active changes fails entirely (e.g. the `openspec` CLI
  is not installed, or the workspace has no OpenSpec root)
- **THEN** the process prints a clear error to stderr and exits with code
  `2`, distinct from a validation failure

### Requirement: A failing merge gate states the reason the tool gave

Where the underlying `openspec` CLI reports why a change did not pass,
the aggregated report SHALL carry that reason.

An invalid change SHALL be reported as invalid — with its issues and its
counts — and not as a change that could not be validated. The two are
different findings: the first says fix the change, the second says
something is wrong with the tooling or the directory, and a reader acts
differently on each.

Where the tool exits non-zero but prints the report it was asked for,
that report SHALL be used. The exit code SHALL remain the signal only
where there is no report to read.

A reason consisting solely of runtime noise — a warning banner, a
deprecation notice — is not a diagnosis. Where no diagnosis can be
recovered, the report SHALL say that rather than presenting noise as an
explanation.

#### Scenario: A change fails strict validation

- **WHEN** the underlying CLI exits non-zero for a change and prints its
  report, naming what is wrong
- **THEN** that change is reported as invalid, carrying the reported
  issues and counts rather than an opaque error

#### Scenario: The tool writes a warning to its error stream

- **WHEN** the underlying CLI's runtime prints a warning while also
  printing a usable report
- **THEN** the reported reason is the diagnosis, not the warning

#### Scenario: Nothing usable was produced

- **WHEN** the underlying CLI exits non-zero and prints no report that
  can be read
- **THEN** the change is reported as one that could not be validated, and
  the reason states that no diagnosis was reported

#### Scenario: The exit-code contract is unchanged

- **WHEN** any of the above occurs
- **THEN** the process still exits `1` for a validation failure and `2`
  only where the check itself could not run

### Requirement: The browser suite does not depend on apt sources it never reads

Installing the browser suite's system dependencies SHALL NOT fail
because of an apt source this repository installs nothing from.

The runner image carries third-party sources; `--with-deps` reads all of
them through `apt-get update`, so a bad publish anywhere on the image
fails an install that has nothing to do with it. Observed three times
across half an hour on 2026-09-09, all from Google's Chrome repository,
which this job never installs a package from.

The system dependencies themselves SHALL still be installed. The source
is what is removed, never the check that the libraries Chromium needs
are present.

#### Scenario: A third-party repository failing to publish

- **WHEN** an apt source on the runner image serves an index that does
  not match its hashes
- **THEN** the browser install still succeeds, because that source is
  not read

#### Scenario: The dependencies Chromium needs

- **WHEN** the browser is installed in CI
- **THEN** its system dependencies are installed with it

### Requirement: A change can be run from a terminal

The CLI SHALL accept a command that runs one named change through the
Agentic Harness chain, resolving that change's harness configuration and
dispatching on it exactly as an interactive host does.

The run SHALL use the same chain, the same agent allowlist, the same
working-directory sandbox and the same audit log as a run started from
either interactive host. A run started here SHALL be visible to them:
recorded in the workspace's audit log, counted against the same spending
totals, and subject to the same configured ceilings.

The process SHALL exit `0` where the chain completed, `1` where the
change did not complete — a stage failed, the change's declared checks
failed, or the run was cancelled — and `2` where the CLI declined to
start or could not start. The reason SHALL be printed in every non-zero
case, so the code never has to be interpreted on its own.

#### Scenario: A change whose configuration permits an unattended chain

- **WHEN** a change whose resolved configuration runs without asking
  anything is named
- **THEN** the chain runs, its events are printed as they arrive, and the
  process exits `0` on completion

#### Scenario: A stage fails

- **WHEN** a stage of the chain fails
- **THEN** the process exits `1` and the failure's reason is printed

#### Scenario: The run is recorded

- **WHEN** a chain is run from the terminal
- **THEN** its agent invocations appear in the same workspace audit log
  an interactive host writes to

### Requirement: The terminal never lowers a gate

The CLI SHALL run only what the change's resolved configuration already
permits, and SHALL provide no option that permits more.

There SHALL be no flag that starts a chain for a change whose autonomy
level does not have one, and no flag that answers a confirmation the
configuration asked for. Where a run cannot proceed, the refusal SHALL
name the configuration key that governs it, so the reader is routed to
the file where the decision belongs.

A confirmation the configuration asks for SHALL be put to a person on
the terminal's input. Where that input is not a terminal, there is
nobody to ask, and the run SHALL be refused.

#### Scenario: A change that has no chain

- **WHEN** a change whose autonomy level starts stages individually is
  named
- **THEN** the run is refused, the reason names that level, and the
  process exits `2`

#### Scenario: A confirmation with a person present

- **WHEN** the chain reaches a point the configuration says to confirm,
  and input is a terminal
- **THEN** the choice is put to the person, and their answer continues or
  ends the chain

#### Scenario: A confirmation with nobody present

- **WHEN** a change's configuration asks for confirmations and input is
  not a terminal
- **THEN** the run is refused, the refusal names the setting that would
  make the change runnable unattended, and the process exits `2`

### Requirement: A refusal costs nothing

Every condition that prevents a run SHALL be checked before the first
stage starts.

This SHALL include the agent each stage would use. Where a stage names an
agent this build cannot resolve to a runner, the whole run SHALL be
refused up front, naming the stage and the agent, rather than failing
when the chain reaches that stage.

A run refused for any reason SHALL have invoked no agent and modified no
file in the change.

#### Scenario: A later stage names an unavailable agent

- **WHEN** a change's configuration names an agent this build does not
  have for a stage that is not the first
- **THEN** the run is refused before the first stage, the message names
  the stage and the agent, and no agent was invoked

### Requirement: A run is streamed, not summarised

Output SHALL be written as the run produces it, in both formats.

The default format SHALL be human-readable text naming each stage, the
agent performing it, and the output as it arrives. Text from an agent
that streams its reply in slices SHALL be joined as it is in the
interactive surfaces, rather than printed one slice per line.

The machine-readable format SHALL be one JSON object per line, each the
event as published. It SHALL NOT be a single document written at the end:
a run's output has to be readable while the run is still going.

#### Scenario: Reading a run as it happens

- **WHEN** a chain is running
- **THEN** each stage's output appears as it is produced, before the run
  finishes

#### Scenario: A machine reads the same run

- **WHEN** the machine-readable format is selected
- **THEN** each event is printed as its own line, parseable on its own,
  as it happens

### Requirement: A terminal run holds the workspace to itself

A run started from a terminal SHALL take the same cross-host workspace
lease an interactive host takes, identifying itself as its own kind of
host, and SHALL release it when the run reaches a terminal state.

Where another host holds the workspace, the run SHALL be refused with a
message naming that holder, rather than mutating a workspace another host
is mutating.

A host reading a lease SHALL describe its holder correctly for every kind
of host that can take one.

#### Scenario: Another host is working

- **WHEN** a run is requested while an interactive host holds the lease
- **THEN** the run is refused, the message names the holder, and no stage
  starts

#### Scenario: An interrupted run

- **WHEN** the run is interrupted from the keyboard
- **THEN** the chain is cancelled, the agent's process tree is
  terminated, and the lease is released

### Requirement: A change's declared checks can be run on their own

The CLI SHALL accept a command that runs the mechanical checks a change's
`tasks.md` declares and reports each one's outcome and reason.

It SHALL invoke no agent and spend nothing. The checks it runs SHALL be
the ones the change declares, selected from the closed registry the core
owns; the CLI SHALL neither add to that registry nor accept a check named
on its command line.

A change declaring no checks SHALL be reported as declaring none and SHALL
exit `0`. Declaring no checks is not a failure of the change.

#### Scenario: A change whose checks pass

- **WHEN** the checks a change declares all pass
- **THEN** each is reported with its reason and the process exits `0`

#### Scenario: A change whose checks do not all pass

- **WHEN** at least one declared check fails
- **THEN** every check's outcome is still reported, the failing one names
  what came back, and the process exits `1`

#### Scenario: A change that declares no checks

- **WHEN** a change declaring no mechanical checks is named
- **THEN** the report says so and the process exits `0`

### Requirement: A change can be given its own working directory

The CLI SHALL provide commands to create, list and remove a separate
working directory of the repository for one change, on a branch named
after that change.

Creating one SHALL refuse, changing nothing, where the change is not
present in the commit the directory would be cut from, where the branch
already exists, or where the directory already exists. A change that
exists only as uncommitted files would produce a working directory
without the change it was created for.

Creating one SHALL report the command that runs the chain there, because
the path is long and running it is the next thing to happen.

Removing one SHALL refuse where it holds uncommitted work.

#### Scenario: Giving a change its own directory

- **WHEN** a working directory is created for a committed change
- **THEN** it exists, is on a branch named after the change, contains
  that change, and the command to run the chain there is reported

#### Scenario: A change that was never committed

- **WHEN** a working directory is requested for a change that is not in
  the base commit
- **THEN** it is refused, nothing is created, and the message says to
  commit the change first

#### Scenario: A name already in use

- **WHEN** the branch or the directory already exists
- **THEN** it is refused and nothing existing is altered

#### Scenario: Removing one that still holds work

- **WHEN** removal is requested for a directory with uncommitted changes
- **THEN** it is refused, and the work is left where it is

#### Scenario: Listing them

- **WHEN** the working directories are listed
- **THEN** each is shown with the change it belongs to, and those whose
  change is no longer active are marked

### Requirement: Changes in separate working directories run at the same time

Two chains running in two working directories of one repository SHALL NOT
wait for each other.

The cross-host workspace lease SHALL be held per working directory. That
is what makes it the isolation boundary rather than a queue for the
repository — a second run in a second directory takes its own lease and
proceeds.

#### Scenario: Two changes at once

- **WHEN** a chain is running in one working directory and a chain is
  started in another for a different change
- **THEN** the second starts rather than being refused for the workspace
  being held

#### Scenario: Two runs in one directory

- **WHEN** a second run is started in a working directory whose lease is
  held
- **THEN** it is refused, exactly as it is today

### Requirement: One repository has one spending ceiling

Where a spending ceiling is configured, the total it is measured against
SHALL include what was recorded in every working directory of the
repository, not only the one the run is in.

A ceiling measured per working directory would permit itself once per
directory, so a repository with three of them would silently allow three
times what was configured.

A recorded log that cannot be read SHALL be skipped rather than failing
the run. A directory that has been removed, or belongs to somebody else,
is not a reason to refuse to start.

#### Scenario: Spending recorded in a sibling directory

- **WHEN** a chain checks its budget and another working directory of the
  same repository has recorded usage for that change
- **THEN** that usage counts towards the ceiling

#### Scenario: A sibling's log cannot be read

- **WHEN** one working directory's recorded log cannot be read
- **THEN** the total is made from the ones that can, and the run starts

### Requirement: Every active change reports a state with its reason

The CLI SHALL report, for each active change, whether it is running,
ready to start, or blocked.

A state SHALL carry the fact that produced it. `blocked` SHALL name what
blocks it; `running` SHALL name where it is running. A state a reader
has to investigate is a state that has not been reported.

#### Scenario: A change waiting on another

- **WHEN** a change declares a blocker that is still an active change
- **THEN** it is reported as blocked, naming that change

#### Scenario: A change under way

- **WHEN** a change's working directory currently holds the workspace
- **THEN** it is reported as running, naming that directory

#### Scenario: A change with nothing in its way

- **WHEN** a change declares no unmet blocker and nothing is running it
- **THEN** it is reported as ready

### Requirement: A ready change says what it can start alongside

For each ready change, the report SHALL name the other ready changes it
can be started alongside, and those it cannot together with what they
would collide over.

The answer SHALL be given per pair rather than as a single group of
changes that may run together. Where three changes collide in a chain,
no one grouping is correct, and presenting one hides from the reader
that a choice existed.

#### Scenario: Two changes that do not overlap

- **WHEN** two ready changes share no capability, no declared relation
  and no touched file
- **THEN** each is reported as able to start alongside the other

#### Scenario: Two changes that would meet in the same spec

- **WHEN** two ready changes each deliver a delta for the same
  capability
- **THEN** they are reported as colliding, naming that capability

#### Scenario: Two branches that have edited the same file

- **WHEN** two changes have working directories whose branches have both
  changed a file
- **THEN** they are reported as colliding, naming that file

### Requirement: Collision is derived from what already exists

The report SHALL determine collisions from the relations a change
already declares, from the capabilities its spec delta already names,
and from what its branch already contains.

It SHALL NOT require a change to declare the files or paths it intends
to touch. Such a declaration is written before the work by whoever knows
least about it, is maintained by hand, and once it has drifted is worse
than no declaration at all, because it is believed.

#### Scenario: A change that declares nothing beyond its own specs

- **WHEN** a change carries no extra metadata about what it will touch
- **THEN** it is still placed correctly against the others

### Requirement: Running in parallel requires a working directory each

A change without a working directory of its own SHALL be reported as not
startable in parallel, whatever its relations allow.

One working directory permits one mutating run, so two changes sharing
one are sequential regardless of whether they would collide. The report
SHALL say what would make the change startable alongside another.

#### Scenario: A ready change with nowhere of its own to run

- **WHEN** a ready change has no working directory
- **THEN** the report says it can be started on its own, and what to do
  to run it alongside another

### Requirement: A lease records who took it, as attribution

A workspace lease SHALL record the git identity of the working directory
that took it, where one is configured.

It SHALL be reported as what it is: a self-declared label, the same one
that signs the repository's commits, which anybody can set to anything.
Nothing SHALL be permitted or refused on the strength of it.

A lease taken where no identity is configured SHALL be valid and SHALL
record none, exactly as every lease written before this existed.

#### Scenario: A run in a working directory with a git identity

- **WHEN** a run takes the workspace in a directory that has a git
  identity configured
- **THEN** the lease records it, and a refusal naming the holder names
  it too

#### Scenario: No identity configured

- **WHEN** no git identity is configured
- **THEN** the lease is taken and records none

### Requirement: The holder of a workspace can be asked about

It SHALL be possible to ask who holds a workspace without attempting to
start a run.

The answer SHALL name the kind of host, where it is running, its process,
how long since it last reported itself, and its git identity where one
was recorded. Where nothing holds the workspace, it SHALL say so.

Asking SHALL succeed whether or not the workspace is held: the question
was answered either way.

#### Scenario: Asking about a held workspace

- **WHEN** the holder is asked for and a live lease exists
- **THEN** it is described, and the command reports success

#### Scenario: Asking about a free workspace

- **WHEN** nothing holds the workspace
- **THEN** it says so, and the command reports success

### Requirement: A lease is cleared only where its holder is shown to be gone

Clearing a lease SHALL require establishing that its holder is gone.

A heartbeat older than the staleness window establishes it — that is
what the lease has always meant by a holder no longer being there.

A holder on this same machine whose process is no longer running
establishes it. Checking SHALL NOT signal the process.

Where the holder is on another machine, or its process is still running,
clearing SHALL be refused, saying which of the two it was. Taking a lease
from a live holder would permit a second mutating run against files the
first still holds open, which is what the lease exists to prevent — and
a holder that is stuck is stopped, not robbed.

#### Scenario: A holder whose process has gone

- **WHEN** clearing is requested and the holder is on this machine with
  no such process running
- **THEN** the lease is cleared

#### Scenario: A holder that is still running

- **WHEN** clearing is requested and the holder's process is running
- **THEN** it is refused, and the message says the holder is alive and
  that stopping it is the remedy

#### Scenario: A holder somewhere else

- **WHEN** the holder is on another machine
- **THEN** clearing is refused, saying that it cannot be checked from
  here

#### Scenario: A lease already stale

- **WHEN** the heartbeat is older than the staleness window
- **THEN** the lease is cleared without needing to check any process

### Requirement: What would stop a run can be asked before starting one

It SHALL be possible to ask what this machine and this workspace are
missing, without naming a change and attempting to run it.

The answer SHALL cover the runtime against the versions this repository
pins, the presence of the OpenSpec CLI, the presence of each registered
agent's executable, whether the workspace's harness configuration reads,
who holds the workspace, and whether a git identity is configured.

Each finding SHALL state whether it stops a run or is only worth
knowing, and SHALL name a remedy where the repository has a command for
one.

A workspace held by a live run SHALL be reported as a fact and SHALL NOT
be reported as something that stops a run: a busy workspace is not a
broken one.

#### Scenario: A machine missing something a run needs

- **WHEN** something a run requires is absent
- **THEN** it is named, marked as stopping a run, and the command that
  remedies it is named where one exists

#### Scenario: A workspace held by a live run

- **WHEN** a run holds the workspace
- **THEN** the holder is reported, and the report does not treat it as a
  failure

### Requirement: An agent's presence is answered by the detection that already exists

Whether an agent is installed SHALL be answered by the same detection
every other surface of this product reads, and SHALL NOT be determined a
second way inside this report.

A command that answered "is this agent here" differently from the agent
picker in the same build would make the product disagree with itself,
and a person would have no way to tell which answer to believe. If the
way presence is detected is wrong, it is wrong for every surface and is
changed in one place.

#### Scenario: Reporting on an installed agent

- **WHEN** the report covers an agent whose executable is installed
- **THEN** it reports what the shared detection reports, including the
  version where that detection has one

### Requirement: A report about one change is the preflight's own answer

Where the question is asked about a named change, the answer SHALL come
from the same resolution that would run it, including the setting that
governs any refusal — not from a second implementation of the same
conditions.

Two implementations of "may this change start" drift, and the drift
appears as a report that says yes to a run which is then refused.

#### Scenario: A change whose configuration refuses an unattended run

- **WHEN** the report is asked about a change whose configuration would
  refuse to start here
- **THEN** it states that refusal's own reason and the setting that
  governs it

