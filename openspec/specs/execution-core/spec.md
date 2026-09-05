# execution-core Specification

## Purpose
The single source of truth for product behavior: unified CLI-agent execution
protocol, execution security model, OpenSpec/git state parsing, and change
status derivation — with no HTTP or VS Code API dependency, reusable from both
the standalone server and the VS Code extension host.
## Requirements
### Requirement: Unified command and event protocol
The system SHALL expose the same command set (`plan`, `implement`, `review`,
`status`, `cancel`, `chain`, `confirmCheckpoint`, `resolvePermission`) and
event stream (`started`, `stdout`, `stderr`, `progress`, `completed`,
`failed`, `cancelled`, `stageCompleted`, `checkpoint`, `agentUpdate`,
`permissionRequest`) regardless of which CLI agent runs and which transport
(REST/WS or message bridge) delivers results. The system SHALL NOT contain
separate execution logic implementations in protocol consumers. `chain`,
`confirmCheckpoint`, `stageCompleted`, and `checkpoint` are unchanged from
`agentic-harness-autonomy`; `resolvePermission`, `agentUpdate`, and
`permissionRequest` are additive members introduced by this change. A
transport or client that never sends `resolvePermission` and never
special-cases `agentUpdate`/`permissionRequest` sees no behavior change —
both new event kinds are non-terminal, exactly like `stageCompleted`/
`checkpoint`, so a consumer that does not recognize them can still render a
coherent (if less detailed) event log.

#### Scenario: Same command via different transports
- **WHEN** `implement` is started via REST/WS server and, separately, via a
  message bridge inside VS Code
- **THEN** both consumers receive an identical sequence of event kinds for the
  same real execution

#### Scenario: Client unaware of the new event kinds still renders a coherent log
- **WHEN** an ACP-flavored adapter's run emits `agentUpdate` and
  `permissionRequest` events alongside the existing kinds
- **THEN** a client built before this change, which does not recognize
  `agentUpdate`/`permissionRequest`, does not crash or misinterpret the run
  as terminated, because neither new kind is terminal

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
actually run. When preparing that context for a `plan`/`review`/`implement`
run, the system SHALL read and embed the actual `proposal.md`/`design.md`/
`tasks.md` and delta-spec content of the change named by the run's
`changeDir`, skipping any that do not exist, rather than sending an
otherwise-empty prompt. The prepared context SHALL explicitly instruct the
agent to work only within the named `changeDir` and not read or modify
files under any other `openspec/changes/<id>/` directory.

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
and a per-author change count), rendered as a PDF document.

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

