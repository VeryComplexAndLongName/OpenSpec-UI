# execution-core Specification

## Purpose
The single source of truth for product behavior: unified CLI-agent execution
protocol, execution security model, OpenSpec/git state parsing, and change
status derivation — with no HTTP or VS Code API dependency, reusable from both
the standalone server and the VS Code extension host.
## Requirements
### Requirement: Unified command and event protocol
The system SHALL expose the same command set (`plan`, `implement`, `review`,
`status`, `cancel`, `stop`, `chain`, `confirmCheckpoint`,
`resolvePermission`) and the same event stream (`started`, `stdout`,
`stderr`, `progress`, `completed`, `failed`, `cancelled`, `stageCompleted`,
`checkpoint`, `agentUpdate`, `permissionRequest`, `stopRequested`),
whichever CLI agent runs and whichever transport (REST/WS or message
bridge) delivers the results. The system SHALL NOT contain separate
execution logic in protocol consumers.

`chain`, `confirmCheckpoint`, `stageCompleted`, and `checkpoint` are
unchanged from `agentic-harness-autonomy`. `resolvePermission`,
`agentUpdate`, and `permissionRequest` are additive members. A transport or
client that never sends `resolvePermission`, and never special-cases
`agentUpdate` or `permissionRequest`, sees no change in behavior. Both of
those event kinds are non-terminal, like `stageCompleted` and `checkpoint`,
so a consumer that does not recognize them can still render a coherent,
if less detailed, event log.

`stop` and `stopRequested` are additive members in the same way. A client
that never sends `stop` sees no change in behavior, and `stopRequested` is
non-terminal.

#### Scenario: Same command via different transports
- **WHEN** `implement` is started through the REST/WS server and, separately,
  through a message bridge inside VS Code
- **THEN** both consumers receive an identical sequence of event kinds for
  the same real execution

#### Scenario: Client unaware of the new event kinds still renders a coherent log
- **WHEN** an ACP-flavored adapter's run emits `agentUpdate` and
  `permissionRequest` events alongside the existing kinds
- **THEN** a client built before those kinds existed does not crash, and does
  not treat the run as terminated, because neither kind is terminal

#### Scenario: Client unaware of a stop request
- **WHEN** a run emits `stopRequested` to a client built before it existed
- **THEN** the client does not treat the run as terminated, and still renders
  the run's terminal event when it arrives

### Requirement: AgentRunner abstracts specific CLI agents
The system SHALL provide one execution interface that hides differences between
specific CLI agents (Claude CLI, GitHub Copilot CLI, Codex CLI, Gemini CLI)
and local LLM via OpenAI-compatible API behind adapters, each translating
agent specifics into the same protocol event stream.

#### Scenario: Unexpected agent output format
- **WHEN** an adapter receives output that does not match expected format
  (for example after a CLI update)
- **THEN** the system forwards that output as `stdout` without data loss and
  without crashing the run

### Requirement: Repository contents are data, not executable instructions

The system SHALL pass repository file content (change proposals, issue text,
etc.) to agents strictly as context data. The system SHALL NOT allow this
content to influence command allowlist, execution cwd, or which command is
actually run.

When preparing that context for a `plan`/`review`/`implement` run, the system
SHALL read and embed the content of every existing file the OpenSpec schema of
the change named by the run's `changeDir` declares. That includes delta specs
at any depth under the change's `specs/` directory. The system SHALL skip any
declared file that does not exist, rather than sending an otherwise-empty
prompt, and SHALL embed no file whose resolved path lies outside that
`changeDir`.

The prepared context SHALL explicitly instruct the agent to work only within
the named `changeDir` and not read or modify files under any other
`openspec/changes/<id>/` directory.

#### Scenario: Change file contains an injected instruction

- **WHEN** `proposal.md` for a change contains text framed as an instruction
  to bypass constraints
- **THEN** it does not alter allowlist/cwd execution behavior and is included
  only as prompt content

#### Scenario: A run embeds the actual change content

- **WHEN** a `plan`/`review`/`implement` run is prepared for a change whose
  `proposal.md`, `design.md`, and `tasks.md` all exist
- **THEN** the prepared prompt contains the real content of all three files,
  not only a reference to the change's directory path

#### Scenario: A nested delta spec and a schema's own artifact are embedded

- **WHEN** a run is prepared for a change whose schema declares an `adr`
  artifact generating `adr.md`, and the change has `adr.md` and a delta spec
  at `specs/web/dashboard-foundation/spec.md`
- **THEN** the prepared prompt contains the content of both files

#### Scenario: A declared file that resolves outside the change is not embedded

- **WHEN** a file the change's schema declares resolves, through a link, to a
  path outside the run's `changeDir`
- **THEN** the prepared prompt does not contain that file's content

#### Scenario: Missing artifacts are skipped, not an error

- **WHEN** a run is prepared for a change that has a `proposal.md` but no
  `tasks.md` yet
- **THEN** the prepared prompt embeds `proposal.md`'s content and contains
  no placeholder or error for the missing `tasks.md`

#### Scenario: The agent is told to stay within the named change

- **WHEN** a run is prepared for any change
- **THEN** the prepared prompt explicitly instructs the agent not to read or
  modify files under any `openspec/changes/<id>/` directory other than the
  one named by `changeDir`

### Requirement: Each run is constrained by allowlist and cwd sandbox
The system SHALL validate requested command/args against allowlist and working
directory against workspace boundaries before starting an agent process. The
system SHALL NOT start execution if validation fails.

#### Scenario: Attempted run outside workspace
- **WHEN** a run is requested with cwd outside the current workspace
- **THEN** the system rejects the run before spawn and emits `failed` with a
  reason

### Requirement: Each run is audited
The system SHALL write an audit log entry for every agent run (what ran, cwd,
resulting changes), regardless of success, failure, or cancellation.

#### Scenario: Run failed
- **WHEN** command execution ends with `failed`
- **THEN** the audit log still contains that run entry

### Requirement: Change status is derived in one place
The system SHALL compute change status (`draft`/`in-progress`/`implemented`/
`archived`) through one heuristic function based on change file location and
`tasks.md` state, without persisting status as a separate field.

#### Scenario: Change with partially completed tasks
- **WHEN** a change is under `openspec/changes/` (not `archive/`) and part of
  `tasks.md` checklist items are marked `[x]`
- **THEN** the system computes `in-progress`, not `draft` and not
  `implemented`

### Requirement: OpenSpec CLI JSON is validated at the core boundary
The system SHALL validate fields consumed by delivery adapters before returning
structured OpenSpec CLI results.

#### Scenario: CLI returns valid compatible output with additive fields
- **WHEN** a supported command returns all required fields plus unknown fields
- **THEN** core returns the result without discarding the additive fields

#### Scenario: CLI returns valid JSON with an incompatible shape
- **WHEN** a required consumed field is missing or has an incompatible type
- **THEN** core rejects the result with a typed compatibility diagnostic
- **AND** identifies the command and expected contract

#### Scenario: CLI returns malformed JSON
- **WHEN** a JSON command exits successfully but stdout is not valid JSON
- **THEN** core rejects the result with a typed invalid-JSON diagnostic

#### Scenario: Diagnostic includes CLI output
- **WHEN** core reports an output compatibility failure
- **THEN** the diagnostic includes only a bounded output preview
- **AND** does not expose unbounded child-process output

### Requirement: Best-effort git-derived change and task timestamps

The system SHALL derive, for a given OpenSpec change (active or
archived), a best-effort created date, an archived date when applicable,
and a best-effort completion date per task in `tasks.md`, without
requiring any change to how tasks are authored or checked off. Any date
that cannot be determined (shallow clone, uncommitted file, an
undeterminable blame line) SHALL be reported as absent (`null`) rather
than causing the read to fail.

#### Scenario: Tasks checked off in separate commits

- **WHEN** a change's `tasks.md` has checkboxes that were checked in
  distinct git commits
- **THEN** each checked task's reported date reflects its own commit's
  timestamp

#### Scenario: Tasks checked off in one squash commit

- **WHEN** several tasks were checked as part of a single squash-merge
  commit
- **THEN** all of those tasks report the same date (that commit's
  timestamp) — this is treated as a correct, expected result, not an
  error

#### Scenario: A task has never been checked

- **WHEN** a task's checkbox is still unchecked
- **THEN** its reported date is `null`

#### Scenario: An archived change reports its archive date

- **WHEN** the change is archived (its directory is
  `openspec/changes/archive/YYYY-MM-DD-<name>/`)
- **THEN** the reported archived date is parsed from that folder name,
  without any git call

#### Scenario: Git history is unavailable or insufficient

- **WHEN** the repository is a shallow clone, or a file's history cannot
  be resolved
- **THEN** the affected date(s) are reported as `null`, and the rest of
  the change's data (proposal/design/tasks/spec content, other
  determinable dates) is still returned

### Requirement: Stale-pending-task detection

The system SHALL determine, for a still-pending task, whether it has
sat untouched (per git blame on `tasks.md`) longer than a configurable
threshold, defaulting to 14 days. A task with an undeterminable
last-touched date SHALL never be flagged, and a completed task SHALL
never be flagged regardless of age.

#### Scenario: A pending task untouched past the threshold

- **WHEN** a still-pending task's last-touched date is older than the
  configured threshold
- **THEN** the system reports it as stale

#### Scenario: A pending task touched recently

- **WHEN** a still-pending task's last-touched date is within the
  configured threshold
- **THEN** the system does not report it as stale

#### Scenario: A completed task, regardless of age

- **WHEN** a task is checked off, however old its last-touched date
- **THEN** the system never reports it as stale

#### Scenario: An undeterminable last-touched date

- **WHEN** a pending task's last-touched date cannot be determined
  (e.g. blame unavailable)
- **THEN** the system does not report it as stale

### Requirement: Sprint report generation

The system SHALL generate, for a given set of changes and a date
range, a sprint summary containing each change's best-effort git
authorship, dates, task completion, and a plain-text summary, plus
aggregate statistics (total changes, tasks completed within the range,
and a per-author change count).

The summary SHALL be produced as data. `packages/core` SHALL NOT render
it as a document in any format, and SHALL NOT depend on a library that
renders one.

#### Scenario: Authorship for a change with a single commit

- **WHEN** authorship is determined for a change whose directory has
  exactly one commit touching it
- **THEN** that commit's author is reported as both the primary author
  and the sole contributor

#### Scenario: Authorship for a change with multiple commits by different authors

- **WHEN** authorship is determined for a change touched by commits
  from more than one author
- **THEN** the most recent commit's author is reported as the primary
  author, and every distinct author is listed among the contributors

#### Scenario: A task completed within the requested range

- **WHEN** a selected change's task was completed (per its best-effort
  date) within the requested date range
- **THEN** it counts toward that change's and the report's total
  tasks-completed-in-range figure

#### Scenario: A selected change started before the requested range

- **WHEN** a user explicitly selects a change for the report whose
  created date falls before the requested range
- **THEN** the change still appears in the report; only its
  task-completion counts are filtered by the range

#### Scenario: Authorship is undeterminable

- **WHEN** git history for a change's directory is unavailable or
  yields no commits
- **THEN** the report includes the change with no primary author or
  contributors, rather than failing to generate

### Requirement: Command kind validation has one source of truth

The system SHALL define the set of valid command kinds in exactly one
place in `packages/core`. Any transport-boundary shape check performed
by a delivery adapter (for example, the server's incoming-message
validation) SHALL import that same set rather than declaring its own
list of command kind literals.

#### Scenario: Core adds a new command kind

- **WHEN** a new command kind is added to the core protocol
- **THEN** every adapter's shape-check-based validation recognizes it as
  valid without a matching hand-edit to a separately maintained literal
  list

### Requirement: The Copilot CLI adapter degrades gracefully for an oversized prompt

Because `copilot -p` delivers the prompt only as a positional CLI
argument (no stdin path), the `copilot-cli` adapter SHALL fall back to a
short prompt naming the change's `changeDir` and instructing the agent to
read its artifact files itself, rather than embedding the full content
inline, whenever the full embedded prompt would exceed a safety margin
under the operating system's command-line length limit. Below that
threshold, the adapter SHALL embed the full content as normal.

#### Scenario: A prompt under the threshold embeds full content

- **WHEN** a `plan`/`review`/`implement` run's constructed prompt for
  `copilot-cli` is under the length threshold
- **THEN** the spawned process receives the full embedded artifact
  content as its positional prompt argument, unchanged from today

#### Scenario: A prompt over the threshold falls back to a path-pointing prompt

- **WHEN** a run's constructed prompt for `copilot-cli` exceeds the
  length threshold
- **THEN** the spawned process instead receives a short prompt naming the
  change's directory and instructing the agent to read its artifact
  files itself, and does not receive the oversized content inline

### Requirement: The Claude CLI adapter bypasses interactive permission checks for non-interactive runs

Because `claude -p` (non-interactive print mode) still enforces its
normal interactive tool-approval model by default, and there is no TTY
to answer an approval prompt in a headless run, the `claude-cli` adapter
SHALL pass `--dangerously-skip-permissions` to every spawned process, so
tool use (`Edit`, `Write`, `Bash`, etc.) does not stall on an unanswerable
approval prompt.

#### Scenario: A claude-cli run edits a file within its working directory

- **WHEN** a `plan`/`review`/`implement` run for `claude-cli` needs to
  create or modify a file within its spawned `cwd`
- **THEN** the edit succeeds without stalling on an interactive
  permission-approval prompt

### Requirement: Presence detection allows a slow CLI enough time to start

Agent presence detection SHALL allow an executable enough time to start
before concluding it is absent, so that an installed CLI on a loaded
machine is not reported as missing. An executable that cannot be found
SHALL still resolve immediately rather than waiting out that budget.

#### Scenario: An installed CLI is slow to start

- **WHEN** an agent's executable exists but takes several seconds to
  respond to a version probe
- **THEN** detection reports that agent as present

#### Scenario: The executable does not exist

- **WHEN** an agent's executable cannot be found on the machine
- **THEN** detection reports that agent as absent without waiting for the
  probe budget to elapse

#### Scenario: A probe never completes

- **WHEN** a probe neither exits nor fails within the budget
- **THEN** detection reports that agent as absent rather than waiting
  indefinitely

### Requirement: A status result does not claim task progress it does not have

When the underlying tool reports no task progress for a change, the
status result SHALL report that progress is unknown, rather than
substituting a value derived from which artifact files exist. An
artifact's completeness means the file is present; it says nothing about
whether the change's tasks are done, and the two SHALL NOT be reported
through the same value.

#### Scenario: The tool reports task progress

- **WHEN** the underlying tool includes task progress for a change
- **THEN** it is reported unchanged

#### Scenario: The tool reports no task progress

- **WHEN** the underlying tool includes no task progress
- **THEN** the result reports progress as unknown, and no value is
  derived from artifact presence

### Requirement: A run's prompt carries the project's rules for the work being done

The prompt built for an agent run SHALL include the project's own
instructions for the artifact the run works on, in addition to the
change's content. The rules SHALL be presented as rules the run is
expected to follow, distinctly from the change's files, which remain
reference data.

The section SHALL carry only the constraints that govern how the work is
carried out. Directives addressed to a run that authors the artifact —
including any instruction to create it, and any list of files to read
before creating it — SHALL NOT appear in the prompt, because the run
receiving them is carrying the artifact out rather than writing it.

When those instructions cannot be obtained, the run SHALL proceed with
the prompt it would otherwise have built, rather than failing.

#### Scenario: Rules are available

- **WHEN** a prompt is built for a run whose command kind maps to an
  artifact, and the project's instructions for that artifact can be
  obtained
- **THEN** the prompt contains them in their own section, labelled as
  rules to follow and separate from the change's content

#### Scenario: The source of the rules also carries authoring directives

- **WHEN** the project's instructions for an artifact are obtained from a
  source whose output also contains directives to author that artifact
- **THEN** only the constraints governing the work reach the prompt, and
  the authoring directives do not

#### Scenario: Rules cannot be obtained

- **WHEN** the project's instructions cannot be obtained
- **THEN** the prompt is built exactly as it would have been without
  them, with no empty section, and the run proceeds

#### Scenario: An adapter that cannot carry the full prompt

- **WHEN** an adapter must fall back to a shortened prompt because the
  full one exceeds what it can deliver
- **THEN** the shortened prompt names how the agent can obtain the
  project's rules itself, rather than omitting them silently

### Requirement: The default allowlist admits one validated model argument

For an adapter that accepts a model, the default allowlist SHALL permit
that adapter's fixed argument shape optionally followed by exactly one
model flag and exactly one model value, and SHALL permit no other
variation. The model value SHALL satisfy the same character restriction
enforced when the configuration was read.

For an adapter that accepts no model, the allowlist SHALL keep matching
its argument shape exactly, unchanged.

#### Scenario: Invocation without a model

- **WHEN** a model-capable adapter is invoked with its fixed arguments
  and no model
- **THEN** the allowlist permits it, exactly as before this capability
  existed

#### Scenario: Invocation with one valid model argument

- **WHEN** a model-capable adapter is invoked with its fixed arguments
  followed by one model flag and one permitted value
- **THEN** the allowlist permits it

#### Scenario: Invocation carrying more than one model argument

- **WHEN** an invocation carries a second model flag, a model flag with
  no value, or a value outside the permitted character set
- **THEN** the allowlist refuses it and the process is not started

### Requirement: A run's audit record carries its resource usage and agent version

The audit record for a run SHALL be able to carry the resource usage
reported for that run and the version of the agent that performed it. Both
SHALL be optional, so that a record written without them remains valid and
readable.

Usage SHALL be recorded only as reported by the agent. The system SHALL NOT
estimate, derive, or otherwise substitute a value for a run whose agent
reported none.

#### Scenario: Usage is reported

- **WHEN** a run's agent reports resource usage for that run
- **THEN** the run's audit record carries it, attributed to that run and
  that agent

#### Scenario: No usage is reported

- **WHEN** a run's agent reports no resource usage
- **THEN** the run's audit record carries none, and the run is otherwise
  recorded exactly as it would have been

#### Scenario: A record written before usage was recordable

- **WHEN** an audit record that predates these fields is read
- **THEN** it remains valid and readable, and is reported as carrying no
  usage

### Requirement: Agent detection reports a best-effort version without gating on it

Agent detection SHALL additionally report the version of each agent it
detects, obtained from the probe it already performs. A version that cannot
be determined SHALL be reported as absent.

Whether an agent counts as detected SHALL NOT depend on whether its version
could be determined.

#### Scenario: The probe reports a readable version

- **WHEN** a detection probe's output contains a version
- **THEN** the detected agent is reported with that version

#### Scenario: The probe reports no readable version

- **WHEN** a detection probe succeeds but its output contains no version
- **THEN** the agent is still reported as detected, with no version

#### Scenario: The probe does not run

- **WHEN** a detection probe fails to start
- **THEN** the agent is reported as not detected, unchanged from before
  versions were reported

### Requirement: Usage is reportable in aggregate, with unmeasured runs distinguished

The system SHALL be able to aggregate recorded usage across runs, grouped by
agent, by model, and by change.

Runs carrying no usage SHALL be reported as a distinct count of unmeasured
runs. They SHALL NOT be counted as zero usage, and SHALL NOT contribute to
any total.

#### Scenario: Runs with and without usage in one report

- **WHEN** an aggregate is built over runs of which some carry usage and
  some do not
- **THEN** the totals reflect only the runs that carry usage, and the runs
  that do not are reported separately as unmeasured

#### Scenario: No runs at all

- **WHEN** an aggregate is built over no runs
- **THEN** it reports zero totals and zero unmeasured runs, rather than
  failing

### Requirement: A configured budget stops work at stage boundaries

The system SHALL support a configured ceiling on what a change's runs may
cost. Where a ceiling is configured, the system SHALL refuse to start a
stage, and SHALL refuse to continue a chain, once recorded usage has
reached it.

The refusal SHALL name the budget as its reason, distinguishably from a run
that failed on its own merits.

A ceiling SHALL be enforced only against usage that was actually reported.
Runs carrying no usage SHALL NOT be counted against it, by any estimate.

The system SHALL NOT be required to interrupt a run already in progress:
enforcement happens at the boundaries between stages, because a run's cost
is not known until it ends.

#### Scenario: Budget remains

- **WHEN** a stage is about to start and recorded usage for its change is
  below the configured ceiling
- **THEN** the stage starts normally

#### Scenario: Budget is exhausted between stages

- **WHEN** a stage completes, recorded usage has reached the ceiling, and a
  further stage would otherwise follow
- **THEN** the chain stops without starting it, and reports the budget as
  the reason rather than a failure of the work

#### Scenario: A run exceeds the ceiling on its own

- **WHEN** a single run's reported usage carries the total past the ceiling
- **THEN** that run is not interrupted, and the ceiling takes effect before
  the next stage starts

#### Scenario: No usage was reported

- **WHEN** runs for a change carry no reported usage
- **THEN** nothing is counted against the ceiling, and no estimate is
  substituted

#### Scenario: No ceiling is configured

- **WHEN** no ceiling is configured
- **THEN** stages and chains proceed exactly as they would without this
  requirement

### Requirement: Cancellation is reported when it happens, not when it is asked for

The system SHALL report a run as cancelled only once the process running
it has ended.

Between the request and that moment the system SHALL report a distinct
state meaning cancellation is in flight. That state SHALL NOT be
terminal: a run in it is still running, and everything that follows from
a run being active SHALL continue to follow.

Where the process does not end, the system SHALL report a failure saying
what was attempted, and SHALL NOT report the run as cancelled.

Where a cancellation names a run the system is not running, it SHALL say
that, and SHALL NOT report a cancellation that did not occur.

#### Scenario: A process that stops

- **WHEN** a run is cancelled and its process ends
- **THEN** the system first reports cancellation in flight, then reports
  the run cancelled

#### Scenario: A process that does not stop

- **WHEN** a run is cancelled and its process does not end
- **THEN** the system reports a failure naming what was attempted, and
  never reports the run as cancelled

#### Scenario: A run that is not running

- **WHEN** a cancellation names a run the system is not running
- **THEN** the system reports that there was nothing to cancel

#### Scenario: A run nobody cancelled

- **WHEN** a run is never cancelled
- **THEN** the events it produces are exactly what they were before this
  requirement

### Requirement: A cancellation reaches the run it names

A cancellation SHALL be delivered to whatever is running the run it
names, whichever agent that run was started against.

Where the request does not carry enough information to identify that,
the system SHALL determine it from the run rather than fall back to a
default. A default is a guess, and a cancellation delivered to the wrong
place reports that there was nothing to cancel while the run continues.

A cancellation SHALL NOT itself be recorded as a unit of work. It is a
signal about a run, not a run.

#### Scenario: Cancelling a run on a non-default agent

- **WHEN** a run started against an agent other than the default is
  cancelled
- **THEN** the cancellation reaches that run, and the run stops

#### Scenario: A cancellation carrying no agent

- **WHEN** a cancellation names a run but not the agent running it
- **THEN** the system resolves the agent from the run itself

#### Scenario: What a cancellation leaves behind

- **WHEN** a cancellation is issued
- **THEN** no new unit of work appears in the list of processes for it

### Requirement: A cancellation that has not taken effect can be repeated

While a run continues to produce output after a cancellation was
requested, the means of cancelling it SHALL remain available, and SHALL
accept a further request.

A report that cancellation is in flight SHALL NOT cause a surface to
present the run as finished, or to withdraw the control that cancels it.

#### Scenario: Cancelling a run that keeps working

- **WHEN** cancellation has been requested and the run is still producing
  output
- **THEN** the control that cancels it is still offered, and pressing it
  again is accepted

#### Scenario: Cancelling a run that stops

- **WHEN** cancellation has been requested and the run has ended
- **THEN** the control is withdrawn, as it is for any finished run

#### Scenario: What the surface says while waiting

- **WHEN** cancellation is in flight
- **THEN** the run is not described as cancelled

### Requirement: A ceiling's reach is described from evidence, not expectation

Where the system tells a person which agents report resource usage, it
SHALL distinguish reporting that has been observed from reporting that is
expected but unobserved.

Where an agent's reporting has been observed, the description SHALL say
which configured ceilings that agent's reporting can act on, and which it
cannot.

The system SHALL NOT present an expectation derived from an agent's
documented output format as an observation of that agent.

#### Scenario: An agent whose reporting has been observed

- **WHEN** a person reads which agents report usage
- **THEN** an agent observed reporting is marked as observed, and the
  ceilings its reporting can act on are named

#### Scenario: An agent whose reporting has not been observed

- **WHEN** an agent's reporting is expected from its output format but
  has not been seen
- **THEN** it is described as expected rather than as observed

#### Scenario: An agent that reports tokens but not cost

- **WHEN** an agent reports token counts and no cost
- **THEN** the description says a cost ceiling cannot act on that agent,
  and a token ceiling can

### Requirement: A run that records no usage is explained

Where a run can terminate without recording usage, the system SHALL say
so where it describes ceilings, so that a person does not assume every
run's spend counts against one.

#### Scenario: A run that fails before reporting

- **WHEN** a run fails without its agent having reported usage
- **THEN** the description makes clear that such a run contributes
  nothing to a ceiling

### Requirement: A run records the resource usage its agent reported

Where an agent reports resource usage for a run, the system SHALL record
it with that run's audit entry, so that anything reading recorded usage
sees what was actually spent.

The system SHALL record only what the agent reported. It SHALL NOT
estimate, derive, or infer a figure, and SHALL NOT record a measure of
something other than consumption as consumption.

Where an agent reports nothing, the run SHALL record no usage at all —
never a zero. Absent means unreported, and a ceiling compared against an
absent figure SHALL continue to permit the work rather than refuse it.

Where a reported cost is expressed in a currency other than the one the
recorded field is defined in, the system SHALL preserve the currency and
SHALL NOT convert between them.

#### Scenario: An agent that reports usage

- **WHEN** a run's agent reports token usage or cost for that run
- **THEN** the run's audit entry carries it

#### Scenario: An agent that reports nothing

- **WHEN** a run's agent reports no usage
- **THEN** the run's audit entry carries no usage field, and a configured
  ceiling still permits the next stage

#### Scenario: A measure that is not consumption

- **WHEN** an agent reports how much of its context window is in use
- **THEN** that figure is not recorded as tokens consumed

#### Scenario: A cost in another currency

- **WHEN** a reported cost is in a currency other than the recorded
  field's own
- **THEN** the currency is preserved and no conversion is performed

### Requirement: A configured ceiling acts on recorded usage

A configured spending ceiling SHALL be compared against the usage
recorded for that change, and SHALL stop the work at the next stage
boundary once the recorded total reaches it.

The system SHALL make clear which agents report usage, so that a person
setting a ceiling can tell whether it can reach their runs at all.

#### Scenario: Recorded usage reaches the ceiling

- **WHEN** the usage recorded for a change reaches its configured ceiling
- **THEN** the chain stops before the next stage, saying it stopped for
  the ceiling and not because a stage failed

#### Scenario: An agent that reports nothing, under a ceiling

- **WHEN** every run for a change reported no usage, and a ceiling is
  configured
- **THEN** the chain continues, because nothing recorded has reached
  anything

### Requirement: Audit records outlive the process that wrote them

The system SHALL persist audit records for a workspace, and SHALL read
them back after a restart.

Persisted records SHALL be readable by any host operating on that
workspace, so that a limit computed from recorded history spans a
change's runs rather than one session's.

#### Scenario: A run recorded, then a restart

- **WHEN** a run is recorded and the host is restarted
- **THEN** that run's audit record is still available

#### Scenario: A limit computed after a restart

- **WHEN** a spending ceiling is evaluated after a restart
- **THEN** it counts runs recorded before that restart

### Requirement: The audit record is bounded

Persisted audit records SHALL be bounded in size. When the bound is
exceeded, the oldest records SHALL be discarded and the newest retained.

The whole record SHALL NOT be discarded on reaching the bound.

#### Scenario: The bound is exceeded

- **WHEN** persisted records exceed the configured bound
- **THEN** the oldest are discarded, the newest remain, and the record is
  not emptied

### Requirement: An unreadable record degrades rather than failing a run

Reading persisted audit records SHALL tolerate an incomplete or
unparseable record: such a record is skipped and the remaining records are
returned.

Where no persisted records exist, reading SHALL report none rather than
failing.

Recording SHALL NOT block the run it describes, and a failure to record
SHALL NOT fail that run.

#### Scenario: A record was interrupted mid-write

- **WHEN** persisted records end with an incomplete entry
- **THEN** every complete entry before it is returned

#### Scenario: Nothing has been recorded yet

- **WHEN** no persisted records exist
- **THEN** reading reports none, without error

#### Scenario: Recording fails

- **WHEN** an audit record cannot be written
- **THEN** the run it describes proceeds unaffected

### Requirement: Every defined event kind survives a transport

An event the core emits SHALL be accepted by the protocol's own
validation for every kind the protocol defines, so that a surface
receiving events over a transport sees what the core emitted rather than
a silently filtered subset.

Where an event kind is added to the protocol, the system SHALL fail its
own checks until that kind's validation exists — a new kind SHALL NOT be
able to reach a transport while being rejected by it.

Validation SHALL continue to reject a payload whose kind the protocol
does not define, rather than raising an error on it.

#### Scenario: An event of a recently added kind

- **WHEN** an event of any kind the protocol defines is sent over a
  transport
- **THEN** it is accepted and delivered to the surface

#### Scenario: A kind added without validation

- **WHEN** a new event kind is added to the protocol and its validation
  is not
- **THEN** the project's own checks fail, rather than the kind being
  discarded at runtime

#### Scenario: A payload of an unknown kind

- **WHEN** a payload arrives whose kind the protocol does not define
- **THEN** it is rejected as invalid, and nothing throws

### Requirement: A cancel command stops the run it names

A command of kind `cancel` SHALL stop the run identified by its run id.

Handling a cancel command SHALL NOT start an agent: it SHALL NOT build an
invocation, SHALL NOT launch a process, and SHALL NOT record the start of
a run.

A cancel command naming a run the system does not have SHALL be reported
as cancelled and SHALL NOT be reported as an error, because a run may end
between the moment cancellation is requested and the moment it arrives.

#### Scenario: Cancelling a running run

- **WHEN** a cancel command names a run that is currently running
- **THEN** that run stops and is reported as cancelled

#### Scenario: Cancelling costs no agent run

- **WHEN** a cancel command is handled
- **THEN** no agent invocation is built, no agent process is started, and
  no run start is recorded for the cancel itself

#### Scenario: Cancelling a run that is already over

- **WHEN** a cancel command names a run the system does not have
- **THEN** it is reported as cancelled, without an error

### Requirement: A running agent process can be terminated

The system SHALL be able to terminate an agent process it started, and
SHALL terminate the processes that process itself started, not only the
process it launched directly.

A run terminated this way SHALL end as cancelled, distinctly from a run
that failed on its own.

After termination the run SHALL emit no further output, and SHALL report
exactly one terminal outcome.

#### Scenario: A run is terminated part-way

- **WHEN** a running agent's run is cancelled
- **THEN** the agent's process is terminated and the run ends as
  cancelled, not as failed

#### Scenario: The agent was launched through an intermediate process

- **WHEN** the agent was launched through an intermediate process, as on
  a platform where the agent is installed as a shim
- **THEN** terminating the run terminates the agent itself, not only the
  intermediate process

#### Scenario: Output buffered at the moment of cancellation

- **WHEN** a run is cancelled while output it produced is still buffered
- **THEN** no output is reported after the terminal outcome, and the
  terminal outcome is reported once

#### Scenario: Cancellation requested before the process starts

- **WHEN** a run is cancelled before its process is launched
- **THEN** no process is launched and the run is reported as cancelled

### Requirement: A handed-off stage is reported distinctly from a completed one

The event protocol SHALL carry a non-terminal event kind meaning "this
stage was handed to the host's own chat", distinct from the terminal
kinds. A run that hands a stage off SHALL emit it instead of a
completion, and SHALL emit no terminal event afterwards, because nothing
observes the handed-off work.

Clients that do not recognise the new kind SHALL still see a coherent
event log, as with the other non-terminal kinds.

#### Scenario: A stage is handed to the host's chat

- **WHEN** a run hands a stage to the host's chat
- **THEN** it emits a start event followed by the hand-off event, and no
  completion, failure or cancellation for that stage

#### Scenario: Terminal kinds are unchanged

- **WHEN** the set of terminal event kinds is examined
- **THEN** it still contains only completion, failure and cancellation —
  the hand-off kind is not among them

### Requirement: A finished run leaves nothing armed

When an agent run ends, the machinery that ran it SHALL leave no timer
armed.

A timer outliving its run holds the process open — a cancelled CLI run
waits for it before exiting — and fires into a stream that has already
terminated. That it does no visible harm today is a property of the
current loop rather than anything guaranteed.

#### Scenario: A cancelled run that the process survived by dying

- **WHEN** a run is cancelled and the child process exits
- **THEN** the stream ends and no timer remains armed

### Requirement: A name from outside the process is checked before it is used

Where a request names a change, the name SHALL be validated against the
change-name rule before it is joined into any path, and the validation
SHALL live in core beside the path it protects.

A host that checks the name and a host that does not are two hosts with
different security models over one function. The function is where the
rule is kept.

Where a request carries a record to be stored, the record SHALL be
validated on the way in by the same rule that will be applied when it is
read back. A record that is accepted and then discarded on read answers
one thing and does another.

Where a request asks for two operations that cannot both be what the
sender meant, it SHALL be refused rather than have one applied.

#### Scenario: A change name that leaves the workspace

- **WHEN** a request names a change with a path component that is not a
  change name
- **THEN** it is refused before any path is built, and the refusal names
  the rule

#### Scenario: A record that would not be read back

- **WHEN** a request stores a record that the reader's own validation
  would discard
- **THEN** it is refused, naming the field

#### Scenario: Two operations in one request

- **WHEN** a request carries both an addition and a removal
- **THEN** it is refused, and nothing is applied

### Requirement: A run reports what it is doing

A run SHALL record what it is currently doing, which change and working
directory it is doing it in, and a heartbeat, in a place readable by
anything that can read the repository's working directories.

The record SHALL be written where no working directory's removal
destroys it.

It SHALL be written such that a partially written record is never read
as a complete one.

#### Scenario: A run in progress

- **WHEN** a run is under way
- **THEN** what it is doing, and when it last said so, can be read
  without asking the run anything

#### Scenario: A run whose working directory is removed

- **WHEN** the working directory a run used is removed
- **THEN** what was recorded about that run is unaffected by the removal

### Requirement: Each run writes only its own record

A run's record SHALL be identified by the run itself, and SHALL NOT be
identified by the person running it: one person may have several runs at
once, and they would otherwise share one record.

The identity SHALL also be carried inside the record, so that a record
found under the wrong identity is reported rather than accepted.

#### Scenario: Two runs by one person

- **WHEN** one person has two runs under way at once
- **THEN** each has its own record and neither overwrites the other

#### Scenario: A record found under an identity that is not its own

- **WHEN** a record's stated identity does not match where it was found
- **THEN** it is reported as such rather than read as that run's

### Requirement: A run that stopped reporting is treated as gone

A record whose heartbeat is older than the staleness window SHALL mean
its writer is gone.

The window SHALL be the one the workspace lease already uses; a second
meaning of "gone" SHALL NOT be introduced.

#### Scenario: A run that ended without tidying up

- **WHEN** a run's record stops being renewed
- **THEN** after the staleness window it reads as a run that is gone

### Requirement: How long since a run said anything is reported, and no verdict is drawn

It SHALL be reported how long it has been since a run last said what it
was doing.

It SHALL NOT be reported that a run is stuck, hung, or unhealthy. A long
period of work produces the same silence, and which of the two it is, is
a judgement for a person.

#### Scenario: A run that has not said anything for a long time

- **WHEN** a run's heartbeat continues but what it reports doing has not
  changed
- **THEN** the interval is reported, and no conclusion about the run's
  health is stated

#### Scenario: A run working normally

- **WHEN** a run reports a new activity
- **THEN** the interval begins again from that moment

### Requirement: Reporting what a run is doing never stops the run

A failure to write, renew or remove a run's record SHALL NOT end the run,
and SHALL NOT reach it as an error.

A run's record SHALL be written one write at a time.

A write refused because the record's name is momentarily in use SHALL be
retried a bounded number of times, and the record SHALL NOT be removed to
make room for it.

No write of a run's record SHALL land after the run has removed that
record on a clean end.

#### Scenario: The record cannot be written at a renewal

- **WHEN** renewing a run's record fails
- **THEN** the run continues, and the next renewal tries again

#### Scenario: A renewal falls due during another write

- **WHEN** a renewal falls due while the record is being written
- **THEN** the two writes happen one after the other

#### Scenario: The record's name is momentarily in use

- **WHEN** replacing the record is refused because its name is in use
- **THEN** the write is retried, and the previous record stays readable
  meanwhile

#### Scenario: A run ends while its record is being written

- **WHEN** a run ends cleanly while a write of its record is under way
- **THEN** no record of that run remains afterwards

### Requirement: A run's status record holds no history

A run's status record SHALL describe only the present: what the run is
doing, and when it last reported.

It SHALL be replaced on each write rather than extended.

What a run did SHALL be recorded in the audit log when it happens, and
SHALL NOT be kept in the status record for collection later.

#### Scenario: A run that crashes

- **WHEN** a run stops without removing its status record
- **THEN** everything it did up to that point is already in the audit
  log, and its status record holds nothing that is not

### Requirement: A record whose writer is gone is removed

A status record whose heartbeat is older than the staleness window SHALL
be removed by a sweep.

A record SHALL be removed only if it is still past the window when read
again immediately before removal.

A record whose writer is still reporting SHALL NOT be removed.

Reading status SHALL NOT remove anything; sweeping SHALL be a separate
operation that reports what it removed.

#### Scenario: A run that crashed hours ago

- **WHEN** a sweep finds a record whose heartbeat is past the window
- **THEN** the record is removed and the sweep reports it

#### Scenario: A slow writer renews in time

- **WHEN** a record read as stale has been renewed by the time it is
  read again
- **THEN** it is not removed

#### Scenario: Reading does not change the directory

- **WHEN** status is read
- **THEN** no record is removed by the reading

### Requirement: A write that never finished leaves nothing behind for good

A temporary file left by a status write that did not complete SHALL be
removed by a sweep once it is older than the staleness window.

#### Scenario: A process that died mid-write

- **WHEN** a sweep finds a temporary status file older than the window
- **THEN** it is removed

### Requirement: A malformed record is kept

A status record that cannot be read, lacks required fields, or names an
identity other than its own SHALL NOT be removed by a sweep.

It SHALL continue to be reported as malformed.

#### Scenario: A record under the wrong identity

- **WHEN** a sweep finds a record whose identity does not match its name
- **THEN** the record is left in place and still reported

### Requirement: A run's record says which task it is on

Where a run has said which task it is on, its status record SHALL carry
that task and SHALL record that the run said so.

A run started for one task SHALL carry that task from the start and SHALL
record that the task was given to it. A later statement by that run naming
another task SHALL NOT replace it.

The task SHALL be written to the record when it is said, and SHALL NOT be
lost to a later line of output.

Only the agent's reply and its standard output SHALL be read for such a
statement. Its reasoning, and the descriptions of its tool calls, SHALL
NOT be read.

A statement SHALL be recognised only when it is a line of its own, in the
form the implementing instruction asks for.

#### Scenario: An agent says which task it is starting

- **WHEN** an agent prints a line saying it is starting task 1.2, followed
  by more output
- **THEN** the record says the run is on task 1.2 by its own account, and
  the activity is the latest line

#### Scenario: A statement inside a longer message

- **WHEN** one message from the agent contains the statement followed by
  further lines
- **THEN** the record says the run is on that task

#### Scenario: Reasoning that mentions a task

- **WHEN** the agent's reasoning contains a line in the form of the
  statement
- **THEN** the record names no task on that account

#### Scenario: A mention inside a sentence

- **WHEN** the agent writes that it is starting task 2.3 as part of a
  longer sentence
- **THEN** the record names no task on that account

#### Scenario: A run given one task

- **WHEN** a run is started for task 6.5 and its agent later says it is
  starting task 1.1
- **THEN** the record says the run is on task 6.5, the task it was given

### Requirement: A run's record says when it is waiting

Where a run is waiting at a checkpoint, or for a permission to be
answered, its status record SHALL say so and say what it is waiting for.
The record SHALL NOT describe such a run as running a stage.

The record SHALL stop saying so at the run's next event that is not
itself a wait.

#### Scenario: At a checkpoint

- **WHEN** a chain pauses at a checkpoint after a stage
- **THEN** the record says the run is waiting to continue to the next
  stage

#### Scenario: A permission request

- **WHEN** a run asks for a permission
- **THEN** the record says the run is waiting for that permission, and
  describes it

#### Scenario: Continuing

- **WHEN** a waiting run continues
- **THEN** the record no longer says it is waiting

### Requirement: A run's record carries the run's id

A run's status record SHALL carry the run id its host started the run
with, so that a surface can tell which of the host's runs the record
describes.

The record's own identity SHALL remain the one the run generated for
itself.

#### Scenario: A record and its run

- **WHEN** a host starts a run with a run id
- **THEN** the run's record carries that id, alongside its own identity

### Requirement: An older record is read, not refused

A status record written before the task, the wait and the run id were
recorded SHALL be read as naming none of them. It SHALL NOT be reported as
malformed on that account.

A malformed value in any of those three fields SHALL be read as absent,
and SHALL NOT make the record malformed.

#### Scenario: A record from before

- **WHEN** a record that has no task, wait or run id is read
- **THEN** it is reported as a run that names none of them, and not as
  malformed

### Requirement: A person's runs sign with that person's key for the machine

A run SHALL sign the record it writes about itself with a key that belongs
to the person running it, on the machine it runs on.

The key SHALL be created the first time it is needed, SHALL have no
passphrase, and SHALL be readable only by its owner where the platform
allows. Each person SHALL have one key per machine, however many runs start
at once.

#### Scenario: The first run on a machine

- **WHEN** a run starts and no key exists for the person on that machine
- **THEN** a key is created, and the run's record is signed with it

#### Scenario: Two runs start at once

- **WHEN** two runs start together and no key exists yet
- **THEN** both runs sign with the same key

### Requirement: What a signature proves is stated exactly

A record SHALL be read as exactly one of three distinct states:

- **verified**: its signature is valid, and its key is enrolled for a
  person;
- **unverified**: it is unsigned, or its key is not enrolled;
- **does not check out**: its signature is invalid, its key does not match
  its identifier, or a different key is enrolled under that identifier.

A record that does not check out SHALL NOT have its contents read or shown,
and SHALL NOT be removed by a sweep.

A verified record SHALL be described as signed by the enrolled person. The
run it describes SHALL still be described as what the record says: a claim.

#### Scenario: An enrolled key

- **WHEN** a record is signed by a key enrolled for a person
- **THEN** it reads as verified, signed by that person

#### Scenario: A key not enrolled

- **WHEN** a record is validly signed by a key that is not enrolled
- **THEN** it reads as unverified

#### Scenario: A changed byte

- **WHEN** one byte of a signed record's contents is changed
- **THEN** the record reads as not checking out, nothing from its contents
  is shown, and a sweep keeps it

#### Scenario: An unsigned record

- **WHEN** a record written without a signature is read
- **THEN** it reads as unverified

### Requirement: The signed bytes are what is read

A record's signature SHALL cover the exact bytes of the record's contents.
Those contents SHALL be parsed only after the signature over them verifies.

#### Scenario: A signature over different bytes

- **WHEN** a record's signature does not verify over the bytes of its
  contents
- **THEN** the contents are not parsed

### Requirement: A run without a key still reports

Where no key can be loaded, a run SHALL write its record unsigned, and SHALL
continue.

#### Scenario: An unreadable key

- **WHEN** a run cannot read the person's key
- **THEN** the run writes an unsigned record and goes on

### Requirement: A key is enrolled by one confirmation

A key that signs a live record and is not enrolled SHALL produce an
enrolment request. The request SHALL carry the run's directory label, its
working directory, the machine, the git author, and when the key was seen.

Confirming the request SHALL enrol the key for the person, once.

Confirming a key identifier that is already enrolled with a different key
SHALL be refused.

#### Scenario: A new machine

- **WHEN** a run on a machine whose key is not enrolled writes a signed
  record
- **THEN** an enrolment request appears for that key, with the facts a
  person needs to decide

#### Scenario: Confirming

- **WHEN** the request is confirmed
- **THEN** that key's records read as verified from then on, and no further
  request appears for it

#### Scenario: A conflicting key

- **WHEN** a confirmation names an identifier already enrolled with another
  key
- **THEN** the confirmation is refused

### Requirement: A run can be asked to stop, and stops where the work is sound

A `stop` command SHALL ask the run it names to stop, and SHALL carry a
reason. Unless the run is waiting, the command SHALL NOT terminate the run's
process at the moment it is asked.

A run that is waiting SHALL stop at once. A run under way SHALL stop at the
first of these moments:

- its agent says it is starting another task;
- one more task of its change is ticked;
- its current stage ends.

No further stage SHALL start after the run stops.

A run that ends this way SHALL end as cancelled, and SHALL NOT be described
as stopped by a rule. Its recorded ending SHALL carry the reason and, where
known, who asked.

A `stop` naming a run the host does not have SHALL be answered as nothing to
stop, and SHALL NOT be reported as an error.

#### Scenario: At a checkpoint

- **WHEN** a stop is asked for a chain waiting at a checkpoint
- **THEN** the chain ends as cancelled at once, and its ending records the
  reason

#### Scenario: The agent starts another task

- **WHEN** a stop is asked while a stage runs, and the agent then says it is
  starting another task
- **THEN** the stage is ended at that moment, and no further stage starts

#### Scenario: A task is ticked

- **WHEN** a stop is asked while a stage runs, the agent names no other task,
  and one more task is then ticked
- **THEN** the stage is ended once the tick is seen

#### Scenario: Nothing to stop

- **WHEN** a stop names a run the host does not have
- **THEN** the answer says there was nothing to stop, and no error is
  reported

### Requirement: A stop request is visible while it is pending

When a stop is asked, the run SHALL report, before it stops, that it was
asked to stop, why, and by whom where that is known.

The run's status record SHALL say so until the run ends.

#### Scenario: A stop that waits for a tick

- **WHEN** a stop has been asked and the run has not yet reached a sound
  point
- **THEN** the run's status record says it was asked to stop, and gives the
  reason

### Requirement: A run elsewhere can be asked to stop through the channel

A person SHALL be able to ask a run that another process started to stop.
The request SHALL be a signed file written into the directory beside the
repository's working directories, addressed to that run's instance
identity, and carrying a reason, the time it was sent, and an identifier of
its own.

Nothing SHALL be written into the run's working directory in order to ask.

#### Scenario: Asking from another working directory

- **WHEN** a person asks a run in another working directory to stop
- **THEN** a signed request addressed to that run is written beside the
  working directories, and no file inside the run's working directory is
  written

### Requirement: A run acts on a request to stop only when it is verified, fresh and new

A run SHALL read the requests addressed to it each time it renews its
record.

It SHALL act on a request that is verified, is not older than the freshness
window, and has not already been seen, as a stop asked of it by the enrolled
person.

It SHALL NOT act on a request that is unverified, does not check out, is
stale, or has already been seen. Where it does not act on a request whose
signature checks out, it SHALL say so once in its record and SHALL record it
in the audit log.

A request's contents SHALL be read only after its signature verifies. A
request whose signature does not check out SHALL NOT be attributed to any
run, and SHALL be reported to whoever reads the channel.

#### Scenario: A verified request

- **WHEN** a verified, fresh request addressed to a run arrives
- **THEN** the run is asked to stop, and names the enrolled person who asked

#### Scenario: The same request again

- **WHEN** a request that the run has already acted on arrives again
- **THEN** it is not acted on a second time

#### Scenario: An unverified request

- **WHEN** a request is signed by a key that is not enrolled
- **THEN** it is not acted on, and the run's record says that a request
  arrived and was not acted on

#### Scenario: A stale request

- **WHEN** a request older than the freshness window arrives
- **THEN** it is not acted on

#### Scenario: A request that does not check out

- **WHEN** a request's contents were changed after it was signed
- **THEN** no run acts on it or reports it as its own, and reading the
  channel reports it

### Requirement: A stated relation can be changed through core

Core SHALL be able to add and remove a relation a change states about
another, writing the change's own metadata file, so that a host offers the
edit without knowing the file's shape.

The rewrite SHALL keep every part of the file the edit does not concern:
other keys, comments, key order, the file's line endings and its trailing
newline. A metadata file is written by hand as well, and an edit that
reorders or strips it would be a worse defect than the one being fixed.

The edit SHALL be refused, with the reason and the ids involved, where it
names a change the workspace does not have, where a change would relate to
itself, where the relations would form a cycle, or where the change being
edited is archived. The refusal SHALL be a value the caller reads, not an
exception it has to parse.

The cycle check SHALL be the one the relation gate uses, run over the
graph as it would be after the edit. Two answers to whether a set of
relations forms a cycle is the drift this requirement exists to prevent.

#### Scenario: Adding a relation

- **WHEN** core is asked to add a relation from one change to another that
  the workspace has
- **THEN** the change's metadata file states it, and every other line of
  that file is unchanged

#### Scenario: Removing the last value

- **WHEN** the relation removed was the only one that key stated
- **THEN** the key is removed rather than left stating nothing, which the
  parser reports as an error

#### Scenario: An id no change has

- **WHEN** the edit names a change that is neither active nor archived
- **THEN** it is refused, naming the id, and no file is written

#### Scenario: An edit that closes a cycle

- **WHEN** the relations after the edit would form a cycle
- **THEN** it is refused, naming the changes in the cycle, and no file is
  written

#### Scenario: An archived change

- **WHEN** the change being edited is archived
- **THEN** it is refused: archiving is what makes the record final

### Requirement: A stop can name the task to stop after

A request to stop SHALL be able to name a task of the change, and a run
that receives one SHALL go on working until that task is done, then stop
where the work is sound.

An operator who wants a run to finish part of a change and stop has,
otherwise, only the choice between watching for the moment and undoing
what came after.

The named task SHALL be counted done when its checkbox is ticked in the
change's task list, or when the run's agent says it is starting a task
that comes after it. The run SHALL end there, rather than at the next
sound point after it: a task's tick is itself a sound point, and waiting
for another one lets the agent into the task the operator asked it not to
start. The run SHALL end cancelled, carrying the reason and the asker as
any stop does.

How soon the run learns that the task was ticked SHALL be a bounded wait,
not the interval a pending stop uses: while a request naming a task is
held, the list SHALL be read often enough that the agent is unlikely to
have started the next task, and the documentation SHALL say that the
window exists rather than promising it away.

A request naming a task the change's list does not have SHALL be refused,
said in the run's activity, and recorded; the run SHALL go on. A request
naming a task already ticked SHALL stop the run at the next sound point,
and SHALL say that the point it named had passed.

The run's recorded ending SHALL name the task it was told to stop after,
beside the reason and the asker.

Nothing here SHALL pause a run. A request that is held is held by the
run's own reading of its task list, and the run keeps working until it is
honoured.

#### Scenario: The named task is reached

- **WHEN** a run is asked to stop after a task, and that task is then
  ticked
- **THEN** the run ends there, without waiting for another marker or
  another tick, and no further stage starts

#### Scenario: The agent moves past the named task

- **WHEN** a run is asked to stop after a task, and its agent then says it
  is starting a task that comes after it
- **THEN** the run stops at that moment

#### Scenario: A task the change does not have

- **WHEN** a request names a task that is not in the change's task list
- **THEN** it is refused with that reason, the run says so, and the run
  goes on

#### Scenario: A point already passed

- **WHEN** a request names a task that is already ticked
- **THEN** the run stops at the next sound point and says the point it was
  given had passed

#### Scenario: What the ending says

- **WHEN** a run ends because it was asked to stop after a task
- **THEN** its recorded ending names that task, the reason and the asker

### Requirement: The sweep clears an empty leftover and a working directory's shell

A directory under a workspace's changes that holds no file at all SHALL
count as holding only what this product wrote, and SHALL be cleared where
a change of its name is archived.

An empty directory holds nothing anybody worked on. The rule that keeps a
person's fresh directory safe is the archive check, not the file count,
and requiring at least one file refused the very case the sweep exists
for.

The sweep SHALL also read the root the working directories live under, and
SHALL report every directory there that git does not list as a working
directory and that holds no file at any depth. Those SHALL be cleared with
the rest. A directory holding one file at any depth SHALL be reported and
never cleared.

Removing a working directory leaves such a shell behind where a link was
inside it, and git stops listing it, so nothing else in the product can
see what the product itself left.

#### Scenario: An empty directory whose change is archived

- **WHEN** a directory under the changes holds no file and a change of its
  name is in the archive
- **THEN** the sweep clears it

#### Scenario: An empty directory nobody archived

- **WHEN** a directory under the changes holds no file and nothing of its
  name is archived
- **THEN** it is reported and left where it is

#### Scenario: A shell left by removing a working directory

- **WHEN** a directory under the worktree root holds no file and git does
  not list it as a working directory
- **THEN** the sweep reports it and clears it

#### Scenario: A directory with something in it

- **WHEN** such a directory holds a file at any depth
- **THEN** it is reported and never cleared

### Requirement: A directory that cannot be removed says what is holding it

Where removing a directory fails, the refusal SHALL name the processes
whose command line mentions that directory, with each process's identifier
and name, and SHALL say that a process which does not name the directory
is not found this way.

An operating system's "access denied" is not something a person can act
on. The three directories that prompted this were held by servers this
product's own checks had started days earlier, and each named its
directory on its command line.

The reading SHALL be best effort: where the process list cannot be read,
the refusal SHALL carry the original error and no holder, rather than
claiming that nothing holds the directory.

#### Scenario: A directory a process holds

- **WHEN** a removal fails and a process names that directory on its
  command line
- **THEN** the refusal names that process, with its identifier

#### Scenario: The process list cannot be read

- **WHEN** a removal fails and the process list cannot be read
- **THEN** the refusal carries the original error and names no holder

### Requirement: A working directory is finished with when the work has landed

Whether a working directory has nothing left to do SHALL be read from git
first: its branch has an upstream, and that upstream is gone. A branch
that was pushed and whose remote branch has since been deleted is what a
merged pull request leaves behind in a repository that deletes its
branches on merge, and it is an answer git gives offline.

The reading SHALL fetch with pruning before it reads, since a deleted
remote branch becomes visible as gone only then. Where the fetch fails,
no directory SHALL be called finished with, and the failure SHALL be the
reason given: a stale reading that removes something is worse than no
reading.

Two further answers SHALL settle it where they are available: the
change's pull request merged, or the default branch carrying that change
archived.

A repository that squashes its pull requests never makes a branch's tip an
ancestor of its default branch, so a merge base alone answers "not
finished" for work that plainly is.

A directory SHALL be called finished with only where its tree is clean and
no run is recorded against it, and the main working directory SHALL never
be called finished with. A branch with no upstream SHALL never be called
finished with, however its change stands: nothing of it was ever pushed.
Each SHALL carry the reason it is finished with, so a surface can say why
rather than assert it, and each directory that is kept SHALL carry the one
reason that kept it.

#### Scenario: A squashed pull request

- **WHEN** a directory's change has a merged pull request, its tree is
  clean and no run is recorded against it
- **THEN** it is finished with, and the reason says the pull request

#### Scenario: Archived on the default branch

- **WHEN** the default branch carries that change archived
- **THEN** the directory is finished with, and the reason says so

#### Scenario: Work still in the tree

- **WHEN** a directory's change has landed but its tree is not clean
- **THEN** it is not finished with

#### Scenario: The branch the server no longer has

- **WHEN** a directory's branch has an upstream that git reports gone,
  its tree is clean and no run is recorded against it
- **THEN** it is finished with, whatever the change stands at and whether
  or not pull requests could be read

#### Scenario: A branch that was never pushed

- **WHEN** a directory's branch has no upstream
- **THEN** it is not finished with, and the reason says the branch was
  never pushed

#### Scenario: A fetch that failed

- **WHEN** the pruning fetch fails
- **THEN** no directory is finished with, and the failure is the reason

### Requirement: The signed channel carries a conversation

The signed message directory (ADR 0028) SHALL carry, beside a request to
stop, a `note`, an `ask` and an `answer`. Each SHALL be sealed with the
sender's machine key, addressed to one run or one person, and refused as a
stop request is refused when it does not verify, is stale, or has already
been read.

Each message SHALL say what kind of sender wrote it, as `person` or `run`.
That claim SHALL NOT establish identity: only the roster and the signature
do.

A run SHALL take a message whose author is a person. A run SHALL refuse a
message whose author is a run unless its harness configuration allows
messages from runs, and SHALL record the refusal.

A `note` and an `ask` SHALL stay fresh for one day rather than for the
minute a stop request stays fresh, and SHALL be removed once delivered
rather than by the clock.

#### Scenario: A note is delivered to the run it names

- **WHEN** a person leaves a note for a run, sealed with their key
- **THEN** the run reads it at its next status renewal, records who said it
  and what was said, and removes it from the directory

#### Scenario: A message from another run is refused by default

- **WHEN** a run's message is addressed to a run whose configuration does
  not allow messages from runs
- **THEN** it is not delivered, and the refusal is recorded with its
  message id

#### Scenario: A message that does not verify is not read

- **WHEN** a message's envelope does not check out against the roster
- **THEN** its words are never parsed and it is delivered to nobody

### Requirement: A run delivers what it was told and answers what it was asked

A run SHALL deliver the messages it has taken to its agent in the prompt
context of the next stage it starts, saying who said each and when, and
marking them as words from a person rather than as content read from the
repository.

Where a message is an `ask`, the run SHALL write an `answer` addressed to
the sender when that stage ends, carrying what the agent said in that
stage, the stage's name and the run's id. What the agent said SHALL be the
stage's closing summary where it has one, and otherwise the tail of what
the stage streamed, bounded in length. Only a stage that said nothing at
all SHALL answer that it said nothing.

#### Scenario: A note reaches the next stage

- **WHEN** a note is taken while a stage is running
- **THEN** the next stage's prompt carries it, with who said it and when

#### Scenario: A question is answered when the stage ends

- **WHEN** an ask is taken and the stage that carried it ends
- **THEN** an answer addressed to the asker is written, carrying what the
  agent said, the stage and the run id

#### Scenario: A run that ends before a stage starts

- **WHEN** a run takes a note and then ends without starting another stage
- **THEN** the note is recorded as taken and undelivered, and no answer is
  invented

#### Scenario: A stage with no closing summary

- **WHEN** the stage that carried a question ends without a summary of its
  own, having streamed what it did
- **THEN** the answer carries the tail of what it streamed rather than
  reporting that the stage said nothing

### Requirement: The drift between a checkout and its remote is readable

`packages/core` SHALL report, for a workspace, which branch it is on, how
many commits that branch is behind and ahead of the same branch on its
remote, and which of the changes the workspace can see are archived on the
default branch.

The reading SHALL NOT fetch: it reports what the refs already say, and
SHALL state when they were last fetched so a stale count reads as stale.

#### Scenario: A reading of a checkout behind its remote

- **WHEN** the workspace's default branch is behind the same branch on its
  remote
- **THEN** the reading says the branch, the number of commits behind and
  ahead, when the refs were last fetched, and which visible changes the
  default branch already carries archived

#### Scenario: A reading costs no fetch

- **WHEN** the drift is read
- **THEN** no fetch is run, whatever the age of the refs

### Requirement: Catching up is a fast-forward that refuses rather than risks

`packages/core` SHALL offer to bring the checkout's default branch up to
its remote by fast-forward alone.

It SHALL refuse, naming which of these it is, when:

- the working tree is not clean;
- the branch has commits the remote branch does not have;
- the checkout is not on its default branch.

It SHALL NOT stash, merge, rebase or pull. A refusal SHALL leave the
repository as it was.

#### Scenario: A checkout behind its remote

- **WHEN** the default branch is behind its remote and the tree is clean
- **THEN** the reading says how far behind, and catching up moves the
  branch to the remote's commit

#### Scenario: A tree with uncommitted work

- **WHEN** catching up is asked for and the tree is not clean
- **THEN** nothing moves, and the refusal says the tree is not clean

#### Scenario: A branch with commits of its own

- **WHEN** the branch has commits the remote does not have
- **THEN** nothing moves, and the refusal says so with the count

#### Scenario: Another branch checked out

- **WHEN** the checkout is on a branch that is not its default
- **THEN** nothing moves, and the refusal names the branch it is on

### Requirement: An agent working on the repository is visible whether or not it is a run

An agent that works on the repository SHALL be able to report itself into
the same status directory a run reports into, with the same signed,
heartbeating record: who it is, which working directory it is in, and what
it is doing.

A reader SHALL NOT need to distinguish such a record from a run's in order
to show it, and a record SHALL expire by the same staleness window a run's
record expires by.

#### Scenario: Two agents on one machine

- **WHEN** two agents are working in two working directories of one
  repository
- **THEN** each can read the other's record, and a host that lists runs
  lists both

#### Scenario: An agent that stops reporting

- **WHEN** an agent's record is not renewed within the staleness window
- **THEN** it reads as gone, as a run's record does

### Requirement: A shared resource on one machine can be claimed

A resource that is not a working directory - this machine's browser
capture suite, a port, the editor under test - SHALL be claimable by a
signed record beside the status directory, naming the claimant, the
resource and when it was taken, and renewed by a heartbeat.

An agent that finds a resource claimed SHALL wait a bounded time, SHALL
say whom it is waiting for while it waits, and SHALL report rather than
proceed when the wait runs out.

A claim SHALL expire when its heartbeat stops, and SHALL NOT be enforced
against an agent that does not ask for it: it makes a collision visible
and attributable, and the operating system owns enforcement.

#### Scenario: A resource already held

- **WHEN** an agent asks for a resource another agent holds
- **THEN** it is told who holds it and since when, waits a bounded time
  saying so, and reports rather than proceeding if the wait runs out

#### Scenario: A claimant that dies

- **WHEN** a claimant stops renewing its claim
- **THEN** the claim expires by the staleness window and the resource can
  be taken

#### Scenario: Two agents asking at once

- **WHEN** two agents ask for the same free resource at the same moment
- **THEN** exactly one holds it, and the other reads the holder's record

### Requirement: The core says where a change is worked and by whom

`packages/core` SHALL answer, for one active change and one survey of the
repository's working directories, which of four things is true of it:

- it is worked in the directory the reading was taken from;
- it is worked in another working directory, which SHALL be named by its
  label and path, with its branch where it has one, and with the enrolled
  person where a verified status record names one;
- it is worked in another working directory whose status record does not
  check out, which SHALL be named without naming any person;
- no working directory has taken it up.

A working directory SHALL be read as working a change both where the
survey pairs the two and where the directory's branch bears that change's
name and the change is present in that directory. The pairing alone holds
only while the change is active on the default branch, which a change
proposed this morning is not.

The sentence each answer is shown as SHALL come from `packages/core` too,
so that two surfaces cannot word the same answer differently. The two
answers about another working directory SHALL have a sentence; this
directory's own change and a change nobody has taken up SHALL have none,
so that a repository worked in one directory does not caption every row
with the same words.

Where no survey could be taken, every change SHALL read as taken up by
nobody, and the reading SHALL NOT fail.

#### Scenario: Another directory is the change's worktree

- **WHEN** a working directory's branch bears an active change's name, and
  a verified record reports an agent working there
- **THEN** the reading says the change is worked in that directory, and
  names the directory and the person

#### Scenario: A record that does not check out

- **WHEN** the only record reporting from that directory fails its
  signature
- **THEN** the reading names the directory, names no person, and says the
  signature did not check out

#### Scenario: A change proposed after the directory was cut

- **WHEN** a working directory's branch bears the name of a change that is
  present there and is not yet on the default branch
- **THEN** the reading says that directory is working it

#### Scenario: A change nobody has taken up

- **WHEN** an active change is in this checkout and no working directory
  is its worktree
- **THEN** the reading says nobody has taken it up

### Requirement: A working directory that is done is removed

The sweep SHALL remove a working directory it reads as finished with,
rather than offering the removal, and SHALL say what it removed and why.

Removing one SHALL remove the worktree and whatever shell is left behind
where a link was inside it. A link SHALL be unlinked and never followed:
a working directory may hold a link to a directory shared with the rest
of the repository, and following one would delete what it points at.

The local branch SHALL be left alone. It costs nothing and it holds the
commits, which matters where a remote branch was deleted without merging
- something git cannot distinguish from a merge.

Nothing under `openspec/changes/` SHALL be read, moved or written while
removing a working directory. A change is repository content, and
archiving one is a separate act with its own commit.

#### Scenario: A directory whose branch is gone

- **WHEN** the sweep finds a working directory that is finished with
- **THEN** it removes the worktree and its shell, leaves the branch, and
  reports what it removed and why

#### Scenario: A directory holding a link

- **WHEN** the directory holds a link to a directory outside it
- **THEN** the link is unlinked and what it pointed at is untouched

#### Scenario: The changes are not touched

- **WHEN** any working directory is removed
- **THEN** no file under `openspec/changes/` has changed

### Requirement: A closed task item says how it ended

A task item that is closed SHALL carry one of three endings, read from
its own line and the lines continuing it:

- **done** - it was carried out;
- **waived** - a person looked and decided not to carry it out;
- **deferred** - it is a judgement about the shipped thing, and it has
  moved to the collection of what waits on a person.

An open item SHALL carry no ending. The ending SHALL be absent rather
than a default where a closed item declares none, which is how every
item written before this existed reads: done.

A closed item marked as needing a person, or naming an agent, SHALL be
reported as unrecorded where nothing is written under it. For such an
item "done" is a claim about something that happened outside the
repository, and what was run and what was seen is the only thing that
makes it checkable afterwards.

#### Scenario: An item a person waived

- **WHEN** a closed item's text carries a waiver naming who decided and
  why
- **THEN** its ending reads as waived

#### Scenario: An item deferred until the work ships

- **WHEN** a closed item's text says it has been deferred
- **THEN** its ending reads as deferred, and the change it belongs to is
  not held open by it

#### Scenario: An ordinary tick

- **WHEN** a closed item declares no ending
- **THEN** its ending reads as done

#### Scenario: A human-only item ticked with nothing written

- **WHEN** an item marked as needing a person is closed and nothing is
  written under it
- **THEN** it is reported as unrecorded

### Requirement: A change is archived only when nothing is owed

Archiving a change through this product SHALL refuse where the change's
task list has an item open, or an item marked as needing a person or
naming an agent that is closed with nothing written under it. The
refusal SHALL name each such item by its number and its text, and SHALL
leave the change where it is.

What an item still owes SHALL be decided in one place that every reader
uses: the merge gate, the archive, and anything else that asks.

#### Scenario: An item still open

- **WHEN** a change with an unticked item is archived through this
  product
- **THEN** the archive refuses, names the item, and nothing moves

#### Scenario: A human-only item ticked with nothing written

- **WHEN** a change whose human-only item is closed with no record is
  archived
- **THEN** the archive refuses and names that item

#### Scenario: Everything closed

- **WHEN** every item is closed, and every human-only or delegated one
  carries a record
- **THEN** the archive proceeds as before

### Requirement: A change's branch that falls behind is rebased and pushed with a lease

The working-directory sweep SHALL rebase a change's branch onto the
default branch and push it with `--force-with-lease`, against the
upstream as it was read before the rebase, where every one of these
holds, each checked rather than assumed:

- the branch bears the name of a change the directory holds;
- its configuration allows it - `branches.rebaseWhenBehind`, absent
  meaning `true`, read from the directory the branch is checked out in so
  that a change in flight answers for itself;
- no run is recorded against its working directory;
- it has an upstream, and that upstream is not gone;
- it is equal to its upstream: nothing of it exists only on this machine,
  and nothing of the server's is missing here;
- it is behind the default branch;
- its working tree is clean.

Each directory whose branch is left alone SHALL carry the one condition
that left it.

A conflict SHALL never be resolved: the rebase SHALL be aborted before the
sweep moves on, leaving the branch and its tree exactly as they were, and
the files in conflict SHALL be named. A push the lease refuses SHALL put
the branch back at the commit it was on.

This setting SHALL NOT widen what the `git` stage may do, and SHALL NOT
push a commit the server has never seen (ADR 0034).

#### Scenario: A behind branch

- **WHEN** a change's pushed branch, equal to its upstream and clean, is
  behind the default branch
- **THEN** it is rebased onto it and pushed, and the server's copy carries
  the default branch's commits beneath the change's

#### Scenario: A conflict

- **WHEN** the rebase conflicts
- **THEN** it is aborted, the branch and its tree are as they were, and
  the files in conflict are named

#### Scenario: Somebody else pushed first

- **WHEN** the lease refuses the push
- **THEN** the branch is put back at the commit it was on, and the refusal
  is reported

#### Scenario: Work that exists only here

- **WHEN** the branch has commits its upstream does not
- **THEN** it is left alone, since a push would carry new work

#### Scenario: Turned off

- **WHEN** the workspace's configuration, or the change's own, sets
  `branches.rebaseWhenBehind` to `false`
- **THEN** that branch is left alone, and the reason says so

### Requirement: The sprint report reads its changes as the timeline does

`packages/core` SHALL build a sprint report from timelines read in
batches, with the archive's dates read once for the whole request, as the
Timeline tab reads them. It SHALL read the authorship of every change from
one git call over `openspec/changes`, counting the commits that touched a
file under each change's directory. Only when that call cannot be made
SHALL it ask per change, and then in batches.

A list of timelines SHALL date each change's proposal from one git call
over `openspec/changes` that lists every commit adding or moving a file
there, following moves as `git log --follow` does. A change that call does
not know SHALL be dated on its own.

Measured on 2026-09-21 over this repository's 296 archived changes: the
report took 109 s when it read every change at once and asked git for each
archive date and each authorship separately.

#### Scenario: The whole archive is selected

- **WHEN** a sprint report is asked for over every archived change
- **THEN** no more than a batch of changes is read at once
- **AND** the archive's dates, the proposals' first commits and the
  changes' authorship are each read by one git call

#### Scenario: A change was moved into the archive

- **WHEN** a commit moved a change's directory under `archive/`
- **THEN** that commit counts toward the archived change's authorship, as
  it does in the per-change read

#### Scenario: Git cannot be asked

- **WHEN** the one authorship call fails
- **THEN** each change's authorship is read on its own, and the report is
  still made

#### Scenario: A change was renamed before it was archived

- **WHEN** a change's directory was renamed and then archived
- **THEN** its proposal is dated from the commit that first added it,
  under its first name

### Requirement: Every run keeps a log

When a host hands its runners the workspace's run logs, `packages/core`
SHALL write each run's log to `.openspec-ui/runs/<runId>.jsonl`. The log
SHALL hold, for every stage the run id is given:

- a start record naming the agent, the kind, the working directory, the
  change, the stage and the task where there is one;
- a line for each event that says something, read the way the hosts read
  it;
- an end record with the outcome, reason and summary.

A run the sandbox or the allowlist refused SHALL get a log whose end says
it was refused and why.

A log SHALL stop at a size cap and say where it stopped, and its end SHALL
still be written. The directory SHALL keep only the newest logs. Writing a
log SHALL NOT delay or fail a run.

Core SHALL list a workspace's logged runs, newest first, and one change's
when asked, without reading each log whole. It SHALL read one run's log by
its id, and SHALL refuse an id that could name a file outside the
directory.

#### Scenario: A run completes

- **WHEN** a run writes to stdout and completes
- **THEN** its log holds its start, what it wrote, and an end that says it
  completed

#### Scenario: A chain runs two stages

- **WHEN** a chain's `propose` and `apply` stages run under one run id
- **THEN** one log holds both, each with its own start and end
- **AND** the list names both stages for that run

#### Scenario: The allowlist refuses a run

- **WHEN** the allowlist refuses a run's invocation
- **THEN** the run's log ends as refused, with the reason

#### Scenario: A run says too much

- **WHEN** a run's output passes the cap
- **THEN** the log says it stopped there, and still ends with the outcome

#### Scenario: A request names a path

- **WHEN** a log is asked for under the id `../audit`
- **THEN** nothing is read

### Requirement: A change that has landed is archived for you

The workspace sweep in `packages/core` SHALL archive every change that has
landed and owes nothing, unless `archive.whenLanded` is `false` for it. A
change has landed and owes nothing when all of these hold on the default
branch, as the server has it after a fetch:

- its directory is in `openspec/changes/`;
- its `tasks.md` has at least one item, and every item is closed and
  recorded;
- no pull request from a branch named after it is open.

Every such change SHALL be archived in one pull request per pass. The pull
request is made on a new `archive-landed-` branch, in a directory outside
the workspace. It is pushed, opened through the forge and asked to merge
when its checks pass. The directory and the local branch SHALL be removed
afterwards, whatever happened. While a pull request from an
`archive-landed-` branch is open, the sweep SHALL open no other.

A change whose own pull request merged while its task list still owes
something SHALL NOT be archived, and the sweep SHALL say what it owes.

The forge SHALL be reached through one interface, implemented for GitHub
through `gh`.

#### Scenario: Two changes landed with nothing open

- **WHEN** two changes' directories are on the default branch with every
  item closed, and neither has an open pull request
- **THEN** one branch reaches the server with both moved into the archive
- **AND** one pull request is opened and asked to merge when its checks
  pass
- **AND** nothing of the pass is left on the machine

#### Scenario: A change is still in review

- **WHEN** a change's task list is closed but its own pull request is open
- **THEN** it is not archived

#### Scenario: An archive pull request is already open

- **WHEN** a pull request from an `archive-landed-` branch is open
- **THEN** no other is opened, and the sweep says what waits for it

#### Scenario: A change landed owing something

- **WHEN** a change's own pull request merged while an item is open
- **THEN** it is not archived, and the sweep names the item

#### Scenario: Nothing is finished

- **WHEN** no change on the default branch has a task list to read
- **THEN** the forge is not asked anything

#### Scenario: One archive fails

- **WHEN** `openspec archive` refuses one of the finished changes
- **THEN** the others are archived, and the one is named with the reason

### Requirement: The sweep finishes a removal git gave up on

When the workspace sweep removes a working directory whose work has landed,
it SHALL remove whatever is left of the directory after
`git worktree remove`, whether that command succeeded or failed. Where git
failed, the sweep SHALL then have git forget worktrees whose directories
are gone. A removal SHALL be reported as failed only where the directory
could not be removed either way, and then with git's reason.

#### Scenario: git gives up on a long path

- **WHEN** `git worktree remove` fails on a finished working directory
- **THEN** the directory is removed anyway, git no longer lists it as a
  worktree, and what a link inside it pointed at is untouched

#### Scenario: The directory cannot be removed at all

- **WHEN** both git and the shell removal fail
- **THEN** the sweep reports the directory as not removed, with git's
  reason

### Requirement: The archive pass pushes only an archive

The pass that archives landed changes SHALL push its branch only where its
commit committed something. Where archiving changed nothing, the pass
SHALL fail with that reason, push nothing and open nothing.

#### Scenario: Archiving changes nothing

- **WHEN** the archive step for every due change leaves the tree as it was
- **THEN** no `archive-landed-` branch reaches the server and no pull
  request is opened

### Requirement: The main checkout follows what landed

After its other work, the workspace sweep SHALL bring the default branch of
the checkout the host has open up to the remote's, by fast-forward alone,
unless `branches.followMain` is `false`. It SHALL do so only when all of
these hold:

- that checkout is the main working directory, on the default branch;
- its tree is clean;
- the default branch has no commits the remote lacks;
- no run is working in it.

Where the branch is behind and the move is refused, the sweep SHALL say how
far behind it is and why. Where the checkout is on another branch, the
sweep SHALL say nothing. It SHALL push nothing.

#### Scenario: A clean main is behind

- **WHEN** a pull request has landed and the owner's clean `main` is one
  commit behind
- **THEN** the sweep fast-forwards it and says it brought `main` up by one
  commit

#### Scenario: The tree holds work

- **WHEN** `main` is behind and its tree has an uncommitted edit
- **THEN** `main` is not moved, and the sweep says it is behind and that
  the tree is not clean

### Requirement: The drift names the changes not shown here

Where the checkout's default branch is behind, the drift reading SHALL
list the changes under way on the remote's default branch that the
checkout does not hold, and the drift line SHALL name them.

#### Scenario: A change landed while the checkout was behind

- **WHEN** a change is under way on `origin/main` and absent from the local
  `main`
- **THEN** the drift line says it is not shown here, by name

### Requirement: An archive pull request names what it archives

The title of a pull request the archive pass opens SHALL name the changes
it archives: every one of them up to two, and beyond two, the first two and
how many more.

#### Scenario: Four changes are archived

- **WHEN** the pass archives four changes
- **THEN** the title names the first two and says "and 2 more"

### Requirement: DeepSeek is an agent, over its CLI's ACP profile

`packages/core` SHALL offer the agent `deepseek-cli-acp`. It SHALL run
`dsh --profile acp` through the shared ACP driver, and the default
allowlist SHALL permit exactly that invocation. Every prompt it is given
SHALL begin with a preamble asking it to follow the instructions literally
and in order. Where the process closes before the agent has said anything,
the run's failure SHALL name the Node version found on the PATH it was
started with.

#### Scenario: A change is implemented by DeepSeek

- **WHEN** a stage names `deepseek-cli-acp` and `dsh` runs on a Node it
  supports
- **THEN** the run streams the agent's updates and ends as the agent ends
  it

#### Scenario: dsh exits without a word

- **WHEN** `dsh` closes before sending any update
- **THEN** the run fails with a reason that says so and names the Node it
  met

