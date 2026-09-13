# agentic-harness Specification

## Purpose
Recommends a CLI agent per OpenSpec-change stage in the Agent Selection
picker, and shows which agent ran a process plus its real progress, via
a two-level (global default + per-change override) configuration the
user can edit natively in either delivery target — never enforcing a
choice, only pre-filling one. See
`docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` for the
full rationale, including why `semi-autonomous`/`autonomous`/the `git`
stepAgent's actual commit/push action are accepted in the config schema
but not yet functional.
## Requirements
### Requirement: Harness configuration is a two-level, product-owned file pair

The system SHALL read Agentic Harness configuration from
`openspec/agent-harness.json` (global default) and, optionally,
`openspec/changes/<id>/harness.json` (per-change override), merged with
the per-change file taking precedence key-by-key over the global file.
Neither file SHALL be part of, or validated by, the upstream `openspec`
CLI's own configuration schema.

#### Scenario: Only a global config exists

- **WHEN** `openspec/agent-harness.json` exists and no per-change
  `harness.json` exists for the requested change
- **THEN** the resolved configuration equals the global file's content

#### Scenario: A per-change file partially overrides the global one

- **WHEN** a per-change `harness.json` sets only `reviewGate.mode`
- **THEN** the resolved configuration uses that `reviewGate.mode` value
  together with every other value (including every `stepAgents` entry)
  inherited unchanged from the global file

#### Scenario: Neither file exists

- **WHEN** no `openspec/agent-harness.json` exists in the workspace
- **THEN** the system uses a documented default (`autonomyLevel:
  "assisted"`, `reviewGate.mode: "human-required"`, no `stepAgents`
  preferences) rather than raising an error

### Requirement: `reviewGate.mode: "agent-sufficient"` is never a valid global setting

The system SHALL reject a global `openspec/agent-harness.json` that sets
`reviewGate.mode` to `"agent-sufficient"`; that value SHALL only be
accepted in a per-change `harness.json`. The system SHALL additionally
reject a global `openspec/agent-harness.json` that sets `autonomyLevel` to
`"autonomous"`, or `checkpoints.requireConfirmationBetweenSteps` to
`false`; both SHALL only be accepted in a per-change `harness.json`.

`agent-sufficient` now has an observable effect: it is the sole condition
under which the `git` stage executes push/pull-request/merge instead of
the chain stopping after `archive`.

#### Scenario: Global file attempts to set agent-sufficient

- **WHEN** `openspec/agent-harness.json` sets `reviewGate.mode:
  "agent-sufficient"`
- **THEN** the system reports a clear validation error and does not
  resolve or apply that value

#### Scenario: Global file attempts to set autonomous

- **WHEN** `openspec/agent-harness.json` sets `autonomyLevel:
  "autonomous"`
- **THEN** the system reports a clear validation error and does not
  resolve or apply that value

#### Scenario: Global file attempts to disable checkpoint confirmation

- **WHEN** `openspec/agent-harness.json` sets
  `checkpoints.requireConfirmationBetweenSteps: false`
- **THEN** the system reports a clear validation error and does not
  resolve or apply that value

#### Scenario: Per-change file sets agent-sufficient

- **WHEN** a per-change `harness.json` sets `reviewGate.mode:
  "agent-sufficient"`
- **THEN** the resolved configuration for that change uses
  `agent-sufficient`, without affecting any other change's resolved
  configuration, and a chain for that change proceeds into the `git` stage
  instead of stopping after `archive`

#### Scenario: Per-change file sets autonomous or disables checkpoint confirmation

- **WHEN** a per-change `harness.json` sets `autonomyLevel:
  "autonomous"`, or `checkpoints.requireConfirmationBetweenSteps: false`
- **THEN** the resolved configuration for that change uses the set value,
  without affecting any other change's resolved configuration

### Requirement: Agent Selection pre-fills from harness config without enforcing it

When a harness configuration resolves a `stepAgents` entry for the
command being opened, the Agent Selection picker (both delivery targets)
SHALL pre-select that agent instead of the last-used agent, while still
allowing the user to pick a different agent before running.

#### Scenario: A stepAgents entry exists for the opened command

- **WHEN** the AI panel opens for a command with a matching
  `stepAgents` entry in the resolved harness configuration
- **THEN** that agent is pre-selected, and selecting a different agent
  and running is still possible

#### Scenario: No harness configuration exists

- **WHEN** no global or per-change harness configuration exists for the
  workspace
- **THEN** the picker behaves exactly as it did before this capability
  existed (last-used agent)

### Requirement: Processes carry agent attribution and derive percent-complete from the task checklist

`WorkbenchProcess` SHALL carry an optional `agentId`, set when the
process was started via a harness-aware Agent Selection pick. Where a
process is associated with a change, the Processes view SHALL show a
percent-complete computed from that change's `completedTasks`/
`totalTasks`, not from the free-text `progress` event field.

#### Scenario: A process started via the picker with a resolved agent

- **WHEN** a process is started after the picker pre-filled or the user
  explicitly chose an agent
- **THEN** `WorkbenchProcess.agentId` records that agent's id

#### Scenario: Percent-complete for a change-associated process

- **WHEN** the Processes view renders a process tied to a change with
  `completedTasks: 3` and `totalTasks: 7`
- **THEN** it shows that ratio as the percent-complete, regardless of
  what the process's own free-text `progress` field currently contains

### Requirement: "Create Change Template" creates a change and optionally configures its harness override in one flow

The VS Code extension SHALL offer a command that creates an OpenSpec
change and then offers to configure that change's per-change Agentic
Harness override (`openspec/changes/<id>/harness.json`) as part of the
same flow, without requiring a separate "configure harness" action
afterward. Declining customization, or answering every question with
"(inherit from global default)", SHALL leave no per-change override file
— identical to a change created without ever running this command.

#### Scenario: Change created without harness customization

- **WHEN** the command is invoked, a change id is entered, and "Use
  global Agentic Harness defaults" is chosen
- **THEN** the change is created and no per-change `harness.json` is
  written

#### Scenario: Change created with an explicit harness customization

- **WHEN** the command is invoked, a change id is entered, "Customize for
  this change" is chosen, and at least one stage/autonomyLevel/
  reviewGate.mode answer is not "(inherit)"/left at default
- **THEN** the change is created and a per-change `harness.json`
  reflecting only the explicitly chosen fields is written

#### Scenario: Cancelling mid-wizard discards the customization, not the change

- **WHEN** the wizard is cancelled (Esc) at any customization question
  after the change has already been created
- **THEN** the change remains created, and no per-change `harness.json`
  is written — answers collected before the cancellation are discarded,
  not partially persisted

#### Scenario: An all-"(inherit)" customization pass writes nothing

- **WHEN** "Customize for this change" is chosen but every question is
  answered "(inherit from global default)"/left at its default
- **THEN** no per-change `harness.json` is written, the same outcome as
  declining customization entirely

### Requirement: `semi-autonomous` chains stages with a checkpoint between each

When a change's resolved harness config has `autonomyLevel:
"semi-autonomous"`, a `"chain"` command SHALL run `propose → review → apply
→ archive` starting from the first not-yet-complete stage, pausing after
each stage's completion and emitting a `checkpoint` event (naming the
finished stage, the next stage, and the next stage's resolved
`stepAgents` agent) instead of proceeding automatically, unless
`checkpoints.requireConfirmationBetweenSteps` resolves to `false` for that
change from a per-change `harness.json`.

#### Scenario: A semi-autonomous chain reaches a checkpoint

- **WHEN** a `"chain"` command runs for a change resolved to
  `semi-autonomous` and a stage completes with a further stage remaining
- **THEN** the system emits a `checkpoint` event and does not start the
  next stage until it receives `"confirmCheckpoint"` on the same `runId`

#### Scenario: Cancelling a paused chain

- **WHEN** `"cancel"` is sent for a `runId` currently paused at a
  checkpoint
- **THEN** the chain ends with a `cancelled` event and no further stage is
  started

### Requirement: `autonomous` chains stages with no checkpoint, and is reachable only from a per-change file

When a change's resolved harness config has `autonomyLevel: "autonomous"`,
a `"chain"` command SHALL run the same stage sequence with no pause,
emitting `stageCompleted` (not `checkpoint`) between stages. The system
SHALL refuse to start such a chain unless the change's own per-change
`openspec/changes/<id>/harness.json` — not the global file, and not any
other inherited value — itself sets `autonomyLevel: "autonomous"`.

#### Scenario: Autonomous chain resolved from a per-change file

- **WHEN** a `"chain"` command runs for a change whose own `harness.json`
  sets `autonomyLevel: "autonomous"`
- **THEN** the chain runs every stage to completion with no checkpoint
  pause, stopping after `archive`

#### Scenario: Autonomous level resolved from any other source is refused

- **WHEN** a `"chain"` command's resolved `autonomyLevel` is `"autonomous"`
  but the change's own per-change `harness.json` does not itself set that
  value
- **THEN** the system refuses to start the chain and emits a `failed` event
  citing the restriction, regardless of what the global file or any other
  inherited value states

### Requirement: A chain never invokes the `git` stepAgent

Regardless of `autonomyLevel` or `reviewGate.mode`, a `"chain"` command
SHALL stop after the `archive` stage completes (or immediately, if
`archive` was the only remaining stage) and SHALL NOT start the `git`
stepAgent under any configuration.

#### Scenario: A fully autonomous chain still stops before git

- **WHEN** an `autonomous` chain completes its `archive` stage
- **THEN** the chain ends with a `completed` event and no git action is
  taken

### Requirement: A "Run with Agentic Harness" action dispatches by resolved autonomy level

Both delivery targets SHALL offer a "Run with Agentic Harness" action on a
change. Invoking it SHALL resolve that change's harness configuration
fresh (not a cached value) and dispatch to the Agent Selection picker for
that change when the resolved `autonomyLevel` is `"assisted"` (the
picker's own existing `stepAgents` pre-fill for whichever stage the user
selects is unchanged — this action does not add new stage auto-selection
beyond what the picker already does); and to a chain run (the `"chain"`
command from the `agentic-harness` capability's chain-execution
requirements) when the resolved `autonomyLevel` is `"semi-autonomous"` or
`"autonomous"`. The action SHALL NOT override or bypass the resolved
configuration in either case.

#### Scenario: Assisted change opens the picker

- **WHEN** "Run with Agentic Harness" is invoked for a change whose
  resolved `autonomyLevel` is `"assisted"`
- **THEN** the Agent Selection picker opens for that change, and no chain
  is started

#### Scenario: Semi-autonomous or autonomous change starts a chain

- **WHEN** "Run with Agentic Harness" is invoked for a change whose
  resolved `autonomyLevel` is `"semi-autonomous"` or `"autonomous"`
- **THEN** a `"chain"` command starts for that change instead of opening
  the single-stage picker

#### Scenario: Resolution is re-read on every invocation

- **WHEN** a change's per-change `harness.json` is edited between two
  invocations of "Run with Agentic Harness" for the same change
- **THEN** the second invocation dispatches according to the newly edited
  configuration, not a value cached from the first invocation

### Requirement: A chain decides its stages from task completion, not artifact presence

A chain SHALL determine whether implementation work remains from the
change's own task list, not from whether its artifact files exist. When
task completion cannot be determined, the chain SHALL choose the
implementation stage rather than the archive stage, so an unknown signal
never selects the irreversible one.

Before archiving, a chain SHALL refuse when any task remains incomplete,
reporting how many remain. A stage's own successful termination SHALL NOT
by itself be treated as evidence that the change is ready to archive.

#### Scenario: Every artifact file exists but no task is done

- **WHEN** a chain starts on a change whose proposal, design, tasks and
  spec files all exist and whose tasks are all incomplete
- **THEN** it starts at the implementation stage, and does not archive

#### Scenario: Task completion cannot be determined

- **WHEN** a chain cannot read the change's task list
- **THEN** it starts at the implementation stage rather than archiving

#### Scenario: Tasks remain incomplete at the archive stage

- **WHEN** a chain reaches the archive stage while at least one task is
  incomplete
- **THEN** nothing is archived, and the chain fails with a message naming
  the change and how many tasks remain

#### Scenario: Every task is complete

- **WHEN** a chain reaches the archive stage and no task remains
  incomplete
- **THEN** the change is archived, as before

### Requirement: The chain reviews the implementation after applying it

The chain SHALL run a verification stage after the stage that implements a
change and before the stage that archives it. The stage SHALL have its own
configurable agent, resolved through the same global and per-change
configuration as every other stage.

The verification stage SHALL examine the implementation against the
change's tasks and its specification delta, and SHALL record any task whose
stated verification does not hold as not done.

This stage SHALL NOT be described or relied upon as sufficient
verification. Tasks that an implementing agent cannot perform remain
outstanding for a human, unchanged.

#### Scenario: A chain reaches verification

- **WHEN** a chain completes the stage that implements a change
- **THEN** it runs the verification stage next, before archiving

#### Scenario: Verification finds an overstated task

- **WHEN** the verification stage finds a task recorded as done whose
  stated verification does not hold
- **THEN** that task is recorded as not done, and the chain does not
  archive the change

#### Scenario: A stage agent is not configured for verification

- **WHEN** no agent is configured for the verification stage
- **THEN** it resolves the same way an unconfigured stage resolves today

#### Scenario: Resuming a change whose tasks are all done

- **WHEN** a chain is started for a change whose tasks are all recorded as
  done and which is not yet archived
- **THEN** it starts at the verification stage rather than at archiving

### Requirement: The verifying agent is given what the run changed

The prompt for a verification stage SHALL carry the set of files the
implementing run changed, in a section distinct from the change's own
content.

That set SHALL be scoped to the run being verified. The system SHALL NOT
substitute the state of the whole working tree, which may contain unrelated
work.

Where the set does not fit the prompt, it SHALL be reduced and the prompt
SHALL state that it was reduced and by how much. It SHALL NOT be omitted
silently.

#### Scenario: The changed files are available

- **WHEN** a verification stage runs after an implementing run whose
  changes are known
- **THEN** its prompt carries those files in their own section

#### Scenario: The changed files are not available

- **WHEN** the changes of the run being verified cannot be determined
- **THEN** the prompt is built as it would be without them, and the stage
  still runs

#### Scenario: More changed files than the prompt can carry

- **WHEN** the changed files exceed what the prompt can carry
- **THEN** the prompt carries as many as it can and states how many were
  omitted

### Requirement: A stage's instruction describes the stage's actual position

Each stage's instruction to its agent SHALL describe the work available at
the point in the chain where that stage runs.

#### Scenario: The stage that runs before implementation

- **WHEN** the stage that runs before a change is implemented instructs its
  agent
- **THEN** the instruction describes reviewing the change's proposal, not
  an implementation that does not exist yet

### Requirement: A harness stage may select a model alongside its agent

A `stepAgents` entry SHALL accept either an agent id on its own, or an
agent id together with a model. When a model is given, it SHALL be passed
to that agent's CLI, which continues to own its own authentication. The
existing agent-id-only form SHALL keep its current meaning, so
configurations written before this capability remain valid unchanged.

A model SHALL be rejected when the configuration is read — not when a run
starts — if it does not match the permitted character set, or if it is
set for an agent that accepts no model.

#### Scenario: A stage names only an agent

- **WHEN** a stage's entry is an agent id on its own
- **THEN** the stage runs on that agent exactly as before, with no model
  passed to its CLI

#### Scenario: A stage names an agent and a model

- **WHEN** a stage's entry names both an agent and a model, and that
  agent accepts a model
- **THEN** the stage runs on that agent with that model selected

#### Scenario: A model set for an agent that accepts none

- **WHEN** a stage names a model for an agent whose registry entry
  declares no model support
- **THEN** reading the configuration fails with an error naming the stage
  and the agent, and no run is started

#### Scenario: A malformed model value

- **WHEN** a stage's model contains whitespace, a quote, or a leading
  dash
- **THEN** reading the configuration fails with an error naming the
  stage, and the value never reaches the spawned process

#### Scenario: The user runs a stage on a different agent than configured

- **WHEN** a stage has a model configured for one agent, and the user
  starts that stage on a different agent
- **THEN** no model is passed, because a model id is specific to the CLI
  it was configured for

#### Scenario: A per-change file overrides the global model

- **WHEN** the global configuration sets one model for a stage and a
  change's own harness file sets another
- **THEN** the change's model is used for that stage

### Requirement: A guided first-run flow configures the global Agentic Harness default

The VS Code extension SHALL offer a re-runnable "Set Up Agentic Harness"
flow that detects available CLI agents and asks the user to choose a
control agent (`propose`/`review`/`archive`), an apply agent (`apply`),
and an autonomy level, writing each answer to the global
`openspec/agent-harness.json` as it is given. Only autonomy levels valid
in the global file (`assisted`, `semi-autonomous`) SHALL be offered.
Successfully initializing a workspace that has no existing
`openspec/agent-harness.json` SHALL surface a dismissible suggestion to
run this flow.

#### Scenario: No agents detected

- **WHEN** the flow runs and `detectAvailableAgents()` reports no
  available agent
- **THEN** the agent/autonomy questions are skipped with an explanatory
  message, and the flow proceeds directly to the CLAUDE.md/AGENTS.md
  question

#### Scenario: Each answer is written immediately

- **WHEN** the control-agent question is answered
- **THEN** the global `openspec/agent-harness.json` reflects that answer
  before the next question is asked, not only after the whole flow
  completes

#### Scenario: Cancelling preserves already-given answers

- **WHEN** the flow is cancelled (Esc) after the control-agent question
  but before the apply-agent question
- **THEN** the global file retains the control-agent answer already
  written, and no further questions are asked

#### Scenario: `autonomous` is never offered globally

- **WHEN** the autonomy-level question is presented
- **THEN** its choices are limited to `assisted` and `semi-autonomous` —
  `autonomous` does not appear, matching the global file's existing
  validation restriction

#### Scenario: Initializing a workspace with no existing harness config suggests the flow

- **WHEN** `openspec-ui.initialize` completes successfully and
  `openspec/agent-harness.json` does not already exist
- **THEN** a dismissible suggestion to run "Set Up Agentic Harness"
  appears

#### Scenario: Initializing an already-configured workspace does not re-suggest

- **WHEN** `openspec-ui.initialize` completes successfully and
  `openspec/agent-harness.json` already exists
- **THEN** no suggestion appears

### Requirement: Choosing `claude-cli` warns on a CLI version mismatch, without blocking

When `claude-cli` is chosen for the control or apply role, the flow SHALL
check the installed `claude` CLI's version against the version this
project last verified against, and show a dismissible warning on a
mismatch, without blocking the flow from continuing.

That version SHALL be read from the single neutral constant every
consumer shares, not from any one consumer's own module: the version is
one fact about the environment, and a second copy of it beside a second
consumer is what ADR 0017 decision 7 exists to prevent.

#### Scenario: Installed Claude CLI version matches the tested version

- **WHEN** `claude-cli` is chosen for a role and the installed `claude
  --version` matches the tested-version constant
- **THEN** no warning is shown

#### Scenario: Installed Claude CLI version differs from the tested version

- **WHEN** `claude-cli` is chosen for a role and the installed `claude
  --version` does not match the tested-version constant
- **THEN** a dismissible warning names both versions and points at
  `docs/adr/0013-acp-agent-adapters.md`, and the flow still allows
  continuing

#### Scenario: `claude --version` cannot be determined

- **WHEN** `claude-cli` is chosen for a role but running `claude
  --version` fails
- **THEN** the check is skipped silently and no warning is shown

### Requirement: An adapter's accepted settings do not depend on which flavour of it was selected

Where two agent ids run the same binary with the same command-line
mechanisms — a plain adapter and its ACP counterpart — the system SHALL
accept the same reasoning-effort values and the same spending-cap field
for both.

A setting SHALL NOT be refused on the grounds that an agent has no
mechanism for it when that agent's own invocation renders the
corresponding flag.

#### Scenario: A reasoning effort on an ACP adapter

- **WHEN** a stage selects an ACP adapter whose invocation renders a
  reasoning-effort flag, and sets an effort its underlying agent accepts
- **THEN** the configuration resolves, and the flag reaches the spawned
  process

#### Scenario: A spending cap on an ACP adapter

- **WHEN** a stage selects an ACP adapter whose invocation renders a
  spending-cap flag, and sets a cap in that agent's own unit
- **THEN** the configuration resolves, and the flag reaches the spawned
  process

#### Scenario: An adapter that renders no such flag

- **WHEN** a stage selects an adapter whose invocation deliberately
  renders no reasoning-effort or spending-cap flag
- **THEN** setting either is still refused, naming the agent

#### Scenario: The unit is still checked

- **WHEN** a stage sets a spending cap in a unit its selected agent does
  not honour, whichever flavour was selected
- **THEN** the configuration is refused, exactly as it is for the plain
  adapter

### Requirement: Every registered agent declares its capabilities explicitly

Every agent id the system offers SHALL have an explicit capabilities
entry, including agents that accept neither a reasoning effort nor a
spending cap.

An absent entry SHALL NOT be the way an agent is described as having no
mechanism: an omission and a deliberate absence are indistinguishable to
a reader and to the validator, and the difference is what a user's
configuration is judged against.

#### Scenario: An agent with no mechanism

- **WHEN** an agent has no command-line reasoning-effort or spending-cap
  mechanism
- **THEN** it carries an explicit, empty capabilities entry, and both
  settings are refused for it

#### Scenario: A newly registered agent

- **WHEN** an agent id is added to the registry without a capabilities
  entry
- **THEN** this is detected, rather than silently refusing every optional
  setting for that agent

### Requirement: An unrecognized key at the top level of a harness configuration is an error

A harness configuration file carrying a top-level key the system does not
define SHALL be refused. The refusal SHALL name the unrecognized key and
list the keys that are defined.

This SHALL apply to the workspace-wide configuration and to a per-change
configuration alike.

The system SHALL NOT accept such a file with the unrecognized key
disregarded, and SHALL NOT infer what the key was meant to be.

#### Scenario: A stage named at the top level

- **WHEN** a per-change configuration names a stage at its top level,
  outside the key that holds stage entries
- **THEN** the file is refused, naming that key, and the message may
  name the correct location as a possibility

#### Scenario: A misspelled top-level key

- **WHEN** a configuration carries a top-level key the system does not
  define
- **THEN** the file is refused, naming that key and the defined ones

#### Scenario: The workspace-wide file

- **WHEN** the workspace-wide configuration carries such a key
- **THEN** it is refused the same way as a per-change one

#### Scenario: A configuration with only defined keys

- **WHEN** every top-level key in a configuration is one the system
  defines
- **THEN** the file is accepted as before, and settings that used to
  migrate still migrate

### Requirement: A task may declare a check the system performs itself

A task SHALL be able to declare a check by name, from a set the system
defines. A task that declares none SHALL behave exactly as it does
without this capability.

The system SHALL perform a declared check itself and SHALL record its
result on that task. An agent's report SHALL NOT record a result for a
task that declares a check.

A declared name the system does not define SHALL be reported as an error
naming the unknown check and the ones it defines, rather than being
ignored.

#### Scenario: A declared check passes

- **WHEN** a task declares a check and that check passes
- **THEN** the task is recorded as done, without an agent being asked
  about it

#### Scenario: A declared check fails

- **WHEN** a task declares a check and that check fails
- **THEN** the task is not recorded as done, and the failure names what
  was checked and what came back

#### Scenario: An agent reports a checked task as done

- **WHEN** an agent reports that a task declaring a check is done, and
  the check did not pass
- **THEN** the task is not recorded as done

#### Scenario: A task declares no check

- **WHEN** a task declares no check
- **THEN** it is handled exactly as before this capability existed

#### Scenario: An unknown check name

- **WHEN** a task declares a check the system does not define
- **THEN** it is reported as an error naming the unknown check and the
  defined ones

### Requirement: A change may only select from checks the system defines

The system SHALL NOT accept a command, an argument list, or any other
executable text from a change's files as a check.

Where a check takes a location, that location SHALL be confined to the
workspace.

#### Scenario: A location outside the workspace

- **WHEN** a declared check names a location outside the workspace
- **THEN** it is refused

### Requirement: Declared checks run before the verifying agent

Where a stage both performs declared checks and invokes an agent, the
checks SHALL run first.

If any declared check fails, that stage SHALL NOT invoke its agent, and
SHALL report which checks failed.

Where all declared checks pass, their results SHALL be available to that
agent, so that it need not repeat them.

#### Scenario: A check fails before the agent runs

- **WHEN** a declared check fails during a stage that would otherwise
  invoke an agent
- **THEN** no agent is invoked and the failing checks are named

#### Scenario: All checks pass

- **WHEN** every declared check passes
- **THEN** the agent is invoked and is told what has already been
  established

### Requirement: A stage that invokes no agent offers none to configure

A stage the system runs without invoking a CLI agent SHALL NOT accept an
agent entry in a harness configuration, and neither settings surface
SHALL offer an agent, reasoning effort or spending cap control for it.

This SHALL hold for every such stage, not for a subset of them. Where the
system runs a stage directly rather than through an agent, that fact
SHALL determine whether the stage can carry an entry.

A configuration that set an entry for such a stage before this
restriction SHALL be read, that entry dropped with a report naming the
stage, and the rest honoured. Such a file SHALL NOT be rejected.

Such a stage SHALL remain listed in both surfaces, since it runs, and
hiding it would misrepresent the sequence.

#### Scenario: Configuring an agent for a mechanical stage

- **WHEN** a configuration sets an agent entry for a stage that invokes
  no agent
- **THEN** the file loads, the entry is dropped, and the report names
  that stage

#### Scenario: Presenting the stages

- **WHEN** a stage runs without invoking an agent
- **THEN** it appears in the stage list with no agent, effort or spending
  cap control

#### Scenario: Several such stages in one configuration

- **WHEN** a configuration sets entries for more than one such stage
- **THEN** every one of them is dropped, and each is named

### Requirement: A stage may set a reasoning effort and a spending cap

A stage's configuration entry SHALL be able to carry a reasoning effort
and a spending cap for the agent that runs it.

Both SHALL be settable in the repository-wide configuration and in a
change's own configuration, resolving through the same merge as every
other stage setting. Neither SHALL be restricted to one of the two files.

An entry that sets neither SHALL produce exactly the command it produced
before these settings existed.

#### Scenario: A repository-wide effort

- **WHEN** the repository-wide configuration sets an effort for a stage
- **THEN** a run of that stage is invoked with it

#### Scenario: A change overrides the repository-wide value

- **WHEN** a change's own configuration sets a different effort for a
  stage that the repository-wide configuration also sets
- **THEN** a run of that stage for that change uses the change's value

#### Scenario: Neither setting is configured

- **WHEN** a stage entry carries neither setting
- **THEN** the agent is invoked exactly as it was before these settings
  existed

### Requirement: A setting an agent cannot honour is refused, never ignored

Where an agent has no way to express a configured setting, the system
SHALL refuse that configuration and SHALL name the agent and the setting.

Where an agent expresses a setting but does not accept the configured
value, the system SHALL refuse it and SHALL name the values it accepts.

A refusal SHALL happen when the configuration is resolved, before any run
starts. The system SHALL NOT accept a setting and then invoke the agent
without it.

#### Scenario: The agent has no such control

- **WHEN** a stage sets a reasoning effort for an agent that has no
  command-line control for it
- **THEN** the configuration is refused, naming that agent and that
  setting

#### Scenario: The agent does not accept the value

- **WHEN** a stage sets a reasoning effort the configured agent does not
  accept
- **THEN** the configuration is refused, naming the values that agent
  accepts

#### Scenario: A spending cap in the wrong unit

- **WHEN** a stage sets a spending cap in a unit its agent does not use
- **THEN** the configuration is refused

### Requirement: Spending caps are carried in each agent's own unit

The system SHALL carry a spending cap in the unit the agent itself uses,
and SHALL NOT convert between units.

#### Scenario: Two agents with different units

- **WHEN** two stages set spending caps for agents that measure spending
  differently
- **THEN** each carries its own unit, and neither value is converted into
  the other

### Requirement: The permitted command shape stays closed

The set of arguments an agent may be invoked with SHALL remain a fixed
prefix plus a known set of optional arguments, each with its own permitted
values.

An argument outside that set, or a permitted argument carrying a value
outside its permitted values, SHALL prevent the run.

Where a setting is expressed through an agent's general configuration
mechanism, only the specific setting SHALL be permitted — not that
mechanism in general.

#### Scenario: A permitted optional argument

- **WHEN** a run is invoked with the expected arguments plus a permitted
  optional argument carrying a permitted value
- **THEN** it is allowed

#### Scenario: A permitted argument with an unpermitted value

- **WHEN** a run is invoked with a permitted optional argument carrying a
  value outside its permitted values
- **THEN** it is refused

#### Scenario: A general configuration mechanism carrying another setting

- **WHEN** a run is invoked with an agent's general configuration
  mechanism carrying any setting other than the one this system
  configures
- **THEN** it is refused

### Requirement: What runs a stage is named once

A stage's configuration SHALL name what runs it in a single selection.
Dispatching a stage to the editor's own chat SHALL be one of the things
that can be selected, not a modifier applied to a selection that is then
disregarded.

A configuration written in the earlier form, where a chat dispatch
accompanied an agent it overrode, SHALL be accepted and mapped to the
single selection, and the mapping SHALL be reported.

#### Scenario: Selecting chat dispatch

- **WHEN** a stage selects the editor's chat as what runs it
- **THEN** the stage is dispatched there, and no agent process is started

#### Scenario: A configuration in the earlier form

- **WHEN** a configuration accompanies an agent with a chat-dispatch
  modifier
- **THEN** it is accepted, mapped to the single selection, and the
  mapping is reported

### Requirement: A parameter that cannot reach anything is refused

A stage entry SHALL be refused when it sets a parameter that whatever
runs that stage has no way to carry.

Where a stage is dispatched to the editor's chat, no parameter intended
for an agent's invocation can be carried, and setting one SHALL be
refused. The refusal SHALL say that the parameter cannot reach anything
in that mode — not merely that it is unaccepted.

A configuration SHALL NOT be accepted with such a parameter disregarded.

#### Scenario: A model set on a chat-dispatched stage

- **WHEN** a stage dispatched to the editor's chat sets a model
- **THEN** the configuration is refused, saying the model cannot reach
  anything in that mode

#### Scenario: A reasoning effort set on a chat-dispatched stage

- **WHEN** a stage dispatched to the editor's chat sets a reasoning
  effort
- **THEN** the configuration is refused for the same reason

#### Scenario: A spending cap set on a chat-dispatched stage

- **WHEN** a stage dispatched to the editor's chat sets a spending cap
- **THEN** the configuration is refused for the same reason

### Requirement: An unrecognized setting is an error, not an omission

A stage entry carrying a setting the system does not define SHALL be
refused. The refusal SHALL name the unrecognized setting and the ones
that are defined.

This SHALL apply to settings nested inside another setting as well as to
top-level ones.

The system SHALL NOT accept such an entry with the unrecognized setting
disregarded, and SHALL NOT merely report it while continuing.

#### Scenario: A misspelled setting

- **WHEN** a stage entry carries a setting whose name the system does not
  define
- **THEN** the configuration is refused, naming that setting and the
  defined ones

#### Scenario: A misspelled setting inside a spending cap

- **WHEN** a spending cap carries a setting the system does not define
- **THEN** the configuration is refused the same way

#### Scenario: A configuration with only defined settings

- **WHEN** every setting in a stage entry is one the system defines
- **THEN** the configuration is accepted as before

### Requirement: The `git` stage executes push, pull-request creation, and merge in sequence

When a chain (`agentic-harness-autonomy`'s `HarnessChainRunner`) reaches the
`"git"` stage, the system SHALL push the change's branch, open a pull
request, and merge it, in that order, as a single stage — using the same
`checkpoint`/`stageCompleted` semantics every other stage already uses (one
`checkpoint` before the stage starts for `semi-autonomous`, one
`stageCompleted`/`completed` after the whole sequence finishes; no
per-action pause within the sequence).

#### Scenario: `git` stage runs after `archive` under `agent-sufficient`

- **WHEN** a chain reaches the `git` stage and the resolved
  `reviewGate.mode` is `"agent-sufficient"`
- **THEN** the system pushes the branch, opens a pull request, and merges
  it, emitting one `checkpoint` (or none, under `autonomous`) before the
  sequence and one `stageCompleted`/`completed` after it

### Requirement: The `git` stage never executes unless `reviewGate.mode` resolves to `agent-sufficient`

The system SHALL NOT push, open a pull request, or merge unless the
resolved `reviewGate.mode` for that change is `"agent-sufficient"`. Under
the default `"human-required"`, a chain SHALL stop cleanly after `archive`,
exactly as it did before this change existed.

#### Scenario: Default review gate stops the chain before git actions

- **WHEN** a chain reaches the point after `archive` and the resolved
  `reviewGate.mode` is `"human-required"` (the default)
- **THEN** the chain ends with `completed` without pushing, opening a pull
  request, or merging anything

#### Scenario: No global default can enable the git stage

- **WHEN** `openspec/agent-harness.json` (global) sets `reviewGate.mode:
  "agent-sufficient"`
- **THEN** the system rejects that global file exactly as it already does
  today (`GlobalAgentSufficientReviewGateError`) — this requirement does
  not introduce any new way to reach `agent-sufficient` globally

### Requirement: A per-change remote/branch allowlist gates every push, pull-request, and merge action

The system SHALL check every `git push`, pull-request creation, and merge
action against an explicit allowlist resolvable only from a per-change
`harness.json` (never the global `openspec/agent-harness.json`), reusing
the existing `checkAllowlist`/`AllowlistConfig` mechanism
(`packages/core/src/security.ts`) that already gates CLI-agent invocations.
An action not matched by the allowlist SHALL be blocked before it runs.

#### Scenario: Push to a remote/branch not in the allowlist

- **WHEN** the git stage attempts to push to a remote/branch combination
  not present in the per-change allowlist
- **THEN** the push is blocked before it runs, and the chain ends with
  `failed` naming the reason

#### Scenario: Global file cannot grant a git-stage allowlist

- **WHEN** `openspec/agent-harness.json` (global) attempts to set a
  git-stage allowlist entry
- **THEN** the system rejects that global file, mirroring the existing
  `GlobalAgentSufficientReviewGateError`/`GlobalAutonomousAutonomyLevelError`
  pattern for other per-change-only settings

### Requirement: A pull request is never merged while its checks have not passed

The system SHALL wait for the pull request's own checks to finish and
SHALL merge only when they have all passed. A pull request whose checks
failed, or for which no check result can be obtained, SHALL NOT be merged;
the stage SHALL end with `failed` naming the check state it saw.

This SHALL NOT be configurable. No configuration value, and no allowlist
entry, SHALL permit merging past a check that has not passed.

#### Scenario: Checks pass

- **WHEN** the git stage has opened a pull request and every check on it
  finishes successfully
- **THEN** the pull request is merged and the stage completes

#### Scenario: A check fails

- **WHEN** a check on the pull request finishes unsuccessfully
- **THEN** the pull request is not merged, and the stage ends with
  `failed` naming the failing check

#### Scenario: No check result is available

- **WHEN** the pull request reports no checks at all
- **THEN** the pull request is not merged, and the stage ends with
  `failed` saying no check result was available — an absent result is
  treated as a refusal, not as permission

#### Scenario: The pull request is left open for a human

- **WHEN** the stage refuses to merge for either reason above
- **THEN** the pushed branch and the open pull request remain, so the
  work is not lost and a human can take it from there

### Requirement: Every git-stage action is audited

The system SHALL write an audit log entry (reusing the existing
`AuditLog`/`AuditEntry` shape in `packages/core/src/security.ts`) for every
push, pull-request creation, and merge attempt, regardless of whether it
succeeded, failed, or was blocked by the allowlist.

#### Scenario: Blocked action is still audited

- **WHEN** a push is blocked by the remote/branch allowlist
- **THEN** the audit log still contains an entry for that attempt, with
  outcome `"blocked"`

### Requirement: A stage may be dispatched through the host's chat instead of a spawned CLI

A stage entry MAY declare that it is dispatched through the host's own
chat rather than by spawning a CLI. When it does, the host SHALL hand the
stage's prompt to its chat and report the stage as handed off — never as
completed, because the work has not been performed at that point and
nothing observes whether it ever is.

This dispatch SHALL be accepted only under the `assisted` autonomy level,
and only in a delivery target that has such a chat. Any other
combination SHALL be rejected when the configuration is read, before a
run starts, rather than falling back to spawning a CLI.

Omitting the dispatch declaration SHALL behave exactly as before this
capability existed.

#### Scenario: A stage declares chat dispatch under `assisted`

- **WHEN** a stage declaring chat dispatch is run in a delivery target
  that has a chat, with `autonomyLevel: assisted`
- **THEN** the host opens its chat with the stage's prompt, and the run
  reports the stage as handed off, with no completion reported for it

#### Scenario: Chat dispatch combined with a chain autonomy level

- **WHEN** a stage declares chat dispatch and the resolved autonomy level
  is `semi-autonomous` or `autonomous`
- **THEN** reading the configuration fails with an error naming the
  stage, because a chain advances on a completion signal that a
  handed-off stage cannot produce

#### Scenario: Chat dispatch in a delivery target with no chat

- **WHEN** a stage declaring chat dispatch is resolved by a delivery
  target that has no such chat
- **THEN** it is reported as an error naming the stage, and no CLI is
  spawned in its place

#### Scenario: No dispatch declared

- **WHEN** a stage entry declares no dispatch
- **THEN** it is spawned as a CLI exactly as before, and is observed,
  streamed and audited as before

### Requirement: A permission request raised inside a chain can be answered

Where a stage's agent asks for permission to act, the answer SHALL reach
the run that asked. A chain SHALL route a permission answer to the runner
executing the stage in flight, rather than treating it as a request to
start work.

The answer SHALL identify the request by the id the asking run published,
not by the id of the chain that contains it. A surface that answers with
the containing run's id names a request no driver is waiting for, which
is indistinguishable from not answering at all.

A surface that displays a chain SHALL offer the control that answers,
since that is where the request becomes visible. A request displayed
without a way to answer it strands the run.

Where a permission request is raised and nothing can answer it — because
the configured autonomy provides no confirmation channel — the run SHALL
fail, naming the request and the reason no answer is possible. It SHALL
NOT wait: a wait that cannot end is indistinguishable from a hang, and
leaves killing the process as the only remaining action.

#### Scenario: The operator answers a request from a chain

- **WHEN** a stage's agent asks for permission and the operator answers
- **THEN** the answer reaches that stage's run and the stage continues

#### Scenario: The answer names the stage, not the chain

- **WHEN** an answer is sent for a request raised by a stage
- **THEN** it identifies the request by the id that stage published

#### Scenario: Nothing can answer

- **WHEN** a stage's agent asks for permission and the configured
  autonomy provides no way to answer
- **THEN** the run fails, naming the request and why no answer is
  possible

#### Scenario: An answer arrives for a request already resolved

- **WHEN** an answer names a request that is no longer pending
- **THEN** it is ignored, and no second request is raised for the same
  action

### Requirement: A run can be bounded in time

The harness SHALL support an optional time ceiling on a whole chain and
on a single stage, configurable globally and per change. An absent
ceiling SHALL mean unbounded, matching every configuration written before
the field existed.

Unlike a spending ceiling, a time ceiling SHALL be able to stop a stage
that is already running. Elapsed time is known while a run is in
progress, where a run's cost is not, and a ceiling that could only stop
the next stage could not stop the stage that has stopped making progress.

Elapsed time SHALL accumulate while a stage is running and SHALL NOT
accumulate while the chain waits for a person at a checkpoint. A person
deliberating is not a run consuming anything, and a ceiling that counted
it would fire on chains behaving exactly as configured.

Where a stage is cut, the work it has already done SHALL be left in
place. A stage cut near the end of its work has produced something a
further attempt can continue from, and the checkpoint taken before the
stage remains available to anyone who wants it undone.

#### Scenario: A stage exceeds its ceiling

- **WHEN** a stage runs longer than the configured stage ceiling
- **THEN** that stage is stopped, and the underlying agent process is
  terminated

#### Scenario: A chain exceeds its ceiling

- **WHEN** the time its stages have spent reaches the configured chain
  ceiling
- **THEN** the chain stops rather than starting further work

#### Scenario: The chain is waiting for a person

- **WHEN** the chain is paused at a checkpoint awaiting confirmation
- **THEN** that time does not count toward either ceiling

#### Scenario: No ceiling is configured

- **WHEN** no time ceiling is set
- **THEN** the run is bounded by nothing, as before

### Requirement: A run stopped by a rule says so

Where the harness stops a run because a configured ceiling was reached,
the run SHALL be reported as cancelled rather than failed, and the report
SHALL state which ceiling was reached and what it was set to.

Stopped by a rule is not the same as broken. Reporting a working ceiling
as a failure teaches a reader to discount failures, and a reader seeing a
cancellation needs to know whether a person asked for it or a rule fired.

Where a run is cancelled by a person, no reason SHALL be required — that
is what a cancellation has always meant.

#### Scenario: A ceiling stops a run

- **WHEN** a run is stopped because it reached a time ceiling
- **THEN** it is reported as cancelled, naming the ceiling and its value

#### Scenario: A person stops a run

- **WHEN** a person cancels a run
- **THEN** it is reported as cancelled, and no reason is required

### Requirement: A stage may be attempted a stated number of times

The harness SHALL support a stated maximum number of attempts for a
single stage, and SHALL record why each attempt after the first happened.

There SHALL be one such number, covering every reason a stage is
attempted again. Separate ceilings per reason multiply: three attempts
for one reason and three for another produce nine runs of a stage that
nobody configured.

Where the attempts are exhausted, the chain SHALL stop and name the
stage and the reasons its attempts ended, rather than continuing to a
stage whose prerequisites were not met.

#### Scenario: A cut stage is attempted again

- **WHEN** a stage was stopped by a ceiling and attempts remain
- **THEN** it may be attempted again, and the attempt records the reason
  the previous one ended

#### Scenario: The attempts are exhausted

- **WHEN** a stage has used every attempt it is allowed
- **THEN** the chain stops, naming the stage and why its attempts ended

### Requirement: What a run has spent against its ceilings is visible while it runs

Where a ceiling is configured, the surface that shows a running chain
SHALL show what has been spent against it beside what has been spent in
money and tokens, and SHALL show the attempt a stage is on where more
than one has been made.

A ceiling nobody can see approaching is indistinguishable from no ceiling
until it fires.

#### Scenario: A time ceiling is configured

- **WHEN** a chain runs with a time ceiling configured
- **THEN** the elapsed time and the ceiling are both shown

#### Scenario: A stage is on a later attempt

- **WHEN** a stage is running for the second or later time
- **THEN** the surface shows which attempt it is on, and why the previous
  one ended

### Requirement: A setting the configuration accepts is one the resolved configuration carries

Every top-level key a harness configuration file accepts SHALL survive
being written and read back, and SHALL survive a per-change file being
merged over a global one.

A key that passes validation and is then discarded produces no error at
the seam: the file is correct, the write succeeds, the read returns a
valid configuration, and a setting simply does nothing. That has already
happened here to two settings at once.

The check SHALL fail when a key is added to the accepted set without
being exercised, so that it cannot decay into a list of the keys someone
remembered — which is exactly what the reader that dropped them already
was.

#### Scenario: A configured key is read back

- **WHEN** a configuration setting any accepted top-level key is written
  and read
- **THEN** the resolved configuration carries that key's value

#### Scenario: A key set only per change

- **WHEN** a per-change configuration sets a key the global one does not
- **THEN** the merged configuration carries it

#### Scenario: A key is added without being exercised

- **WHEN** the accepted set gains a key that the check has no value for
- **THEN** the check fails, naming that key

### Requirement: What an agent reports is recorded, not only documented

What each agent reports back about its own spending SHALL be recorded
alongside what its command line accepts, so that the product can act on
it rather than only a reader.

The record SHALL distinguish an agent observed to report nothing from one
that has never been observed. Treating the unobserved as reporting
nothing would produce confident statements about facts nobody has
checked.

#### Scenario: An agent reports cost and tokens

- **WHEN** the recorded capability of an agent is read
- **THEN** it says whether that agent reports cost, tokens, neither, or
  whether this has never been observed

### Requirement: A configuration says which of its ceilings cannot act

Where a configured ceiling cannot act on the agent chosen for a stage,
the editor SHALL say so where the configuration is chosen, before a run.

A ceiling that cannot fire is indistinguishable from one that has not
fired yet, and the difference is discovered otherwise only by a bill.

Where a stage's agent reports nothing and no time ceiling is configured,
the editor SHALL report that the stage can run without any bound. This is
the finding that matters most, because it is the one with no upper
limit at all.

A configuration SHALL NOT be refused for this. An operator may knowingly
set a ceiling that binds some stages and not others; that judgement is
theirs, and refusing would trade a real use for it.

The report SHALL state what cannot happen and SHALL NOT recommend a
value. What cannot act follows from what an agent reports; what to set
instead needs history the editor does not consult here.

#### Scenario: A cost ceiling over an agent that reports no cost

- **WHEN** a cost ceiling is configured and a stage's agent reports only
  tokens
- **THEN** the editor reports that this ceiling cannot act on that stage

#### Scenario: A stage with no bound at all

- **WHEN** a stage's agent reports nothing and no time ceiling is set
- **THEN** the editor reports that the stage can run without any bound

#### Scenario: An agent never observed

- **WHEN** a stage uses an agent whose reporting has never been observed
- **THEN** the editor says so, rather than asserting that a ceiling will
  or will not act

#### Scenario: The configuration is still accepted

- **WHEN** a configuration contains a ceiling that cannot act
- **THEN** it is saved and used, with the finding reported alongside it

### Requirement: What a change cost can be read after the run

The editor SHALL offer, for any change, a report of what has been spent
against it: each stage that ran, the agent and effort it ran with, what
it reported spending, and how long it took, together with a total.

It SHALL be available whether the change finished or not, and whether it
is active or archived. A change whose run was cut, failed, or exhausted
its attempts is the case where the question is most pressing, because
something was spent and nothing shipped.

A figure the agent did not report SHALL be shown as not reported, never
as zero, and a total SHALL be described as covering only what was
reported. Most supported agents report nothing at all, and a report
showing them as free would be wrong where a reader is least able to
check it.

A record that cannot be attributed to a stage SHALL be shown as
unattributed rather than dropped or assigned to a stage it might not
belong to: dropping it makes the total wrong, and guessing makes a row
wrong.

A change nothing has run against SHALL be reported as such rather than as
an empty table.

#### Scenario: A finished change is asked about

- **WHEN** a report is asked for a change whose chain completed
- **THEN** it shows each stage with its agent, effort, reported spend and
  duration, and a total

#### Scenario: A change that did not finish

- **WHEN** a report is asked for a change whose run was cut or failed
- **THEN** it still shows what was spent, and says how the run ended

#### Scenario: An agent that reported nothing

- **WHEN** a stage's agent reported no usage
- **THEN** that stage shows "not reported" rather than a zero, and the
  total says it covers only what was reported

#### Scenario: A record older than stage attribution

- **WHEN** the change has records that name no stage
- **THEN** they appear as unattributed and are still counted in the total

#### Scenario: Nothing has run

- **WHEN** a report is asked for a change with no records
- **THEN** it says nothing has run against this change

### Requirement: A change can be told which named configuration suits it

The editor SHALL recommend one named configuration for a given change,
and SHALL show the observations it was chosen from alongside it.

A recommendation whose grounds are hidden can only be accepted or
ignored, never disagreed with — and the cases where a reader would
disagree are exactly the cases where the recommendation is worst.

Where little is known about the change, the recommendation SHALL say so
where it gives its answer. Presenting a default silently makes "nothing
is known about this change" indistinguishable from "this is what the
evidence suggests".

The recommendation SHALL NOT propose a spending or time figure derived
from one change's own history. Most changes have a single recorded run
and many have none that reported a cost; a figure drawn from that is
arithmetic presented as evidence.

The recommendation SHALL report rather than configure. A person applies
the named configuration themselves; one nobody chose is one nobody can be
expected to understand when it acts.

#### Scenario: A change with no history

- **WHEN** a recommendation is asked for a change nothing has run against
- **THEN** one is given, and it states that there is no previous run to
  go on

#### Scenario: A change whose previous run hit a ceiling

- **WHEN** the change's last run ended at a configured ceiling
- **THEN** the recommendation allows more room and names the ceiling that
  was reached

#### Scenario: A change that has hit a ceiling repeatedly

- **WHEN** a change has been stopped at a ceiling more than once at the
  most generous configuration
- **THEN** the recommendation says a person should look, rather than
  proposing something larger again

#### Scenario: The grounds are visible

- **WHEN** a recommendation is shown
- **THEN** the observations behind it are shown with it

### Requirement: A configuration can be chosen by intent

The editor SHALL offer named configurations describing what a person is
trying to do, each applying agents, ceilings and autonomy together.

Each SHALL state what it is for **and when it is the wrong choice**. A
list of options carrying only advantages gives no help choosing between
them.

Each SHALL state which of its values were measured and which are
judgement, so that a reader can disagree with the right ones.

Each SHALL declare where it may be applied. Three settings are valid only
in a per-change configuration, and offering them globally would produce a
template refused on save.

#### Scenario: A named configuration is applied

- **WHEN** a person applies one
- **THEN** the agents, ceilings and autonomy it names are set together

#### Scenario: A configuration valid only per change

- **WHEN** a named configuration sets a value a global file may not carry
- **THEN** it is not offered for the global file

### Requirement: A named configuration cannot contradict itself

A named configuration SHALL NOT contain a ceiling that cannot act on the
agent it names for that stage.

The product records what each agent reports, and reports to a person when
a configured ceiling cannot act. Shipping a named configuration that
triggers that report would be publishing the very confusion the report
exists to catch, under the product's own name.

#### Scenario: A named configuration is checked

- **WHEN** a named configuration is examined against what its agents
  report
- **THEN** it produces no finding that a ceiling cannot act

### Requirement: Saving settings preserves configuration the view does not display

Saving from the harness settings view SHALL preserve every accepted
top-level configuration key, including keys the view has no field for.

Both configuration writers replace the file, so a key omitted from a save
is deleted rather than left alone. A person editing which agent runs
`apply` has not asked for a spending ceiling, a stage timeout, an attempt
count or the git staging allowlist to be removed, and SHALL NOT have that
happen as a side effect.

This SHALL hold for the global file and for a per-change override alike.

#### Scenario: A key the view cannot display survives a save

- **WHEN** a configuration containing keys the settings view has no
  fields for is loaded, a displayed field is changed, and the settings
  are saved
- **THEN** the saved configuration still contains those keys, unchanged

#### Scenario: An applied template's ceilings are saved

- **WHEN** a template is applied in the settings view and the settings
  are then saved
- **THEN** the saved configuration contains the ceilings that template
  sets, not only the fields the view displays

### Requirement: Templates are offered where a per-change configuration is edited

The settings view SHALL offer the templates that may be applied to a
change wherever a per-change override is edited, not only for the global
file.

A template whose scope is per-change only is otherwise unreachable: it is
correctly withheld from the global file, and there is nowhere else to
apply it from.

#### Scenario: A per-change-only template can be applied

- **WHEN** a per-change override is being edited
- **THEN** the templates available for a change are offered there,
  including those that may not be applied globally

### Requirement: A template's configuration matches what it says it does

A template's stated behaviour SHALL be reflected in the configuration it
applies.

A template's sentences are its interface: they are what a person reads
before applying it, and what they will hold it to afterwards. A sentence
that is not true is the same defect as a ceiling that cannot act, and it
is harder to notice — the configuration has to be read to see it.

Where a stated behaviour names a specific setting, the templates SHALL be
checked against it mechanically.

#### Scenario: An unattended template does not pause between stages

- **WHEN** a template describes running without stopping for anyone
- **THEN** the configuration it applies turns off confirmation between
  stages, rather than leaving it inherited

### Requirement: A chain acts on its own verification result

Where verification leaves tasks unchecked and the stage that implements
them may be attempted again, the chain SHALL return to that stage rather
than continue to a stage whose precondition it has just been shown does
not hold.

Verification is the only stage that produces a machine-checked statement
that earlier work is unfinished, so this SHALL be the only return: a
chain otherwise runs forward.

The return SHALL be bounded by the same attempt count that bounds every
other reason a stage is attempted again, and SHALL record why it
happened, so that a stage appearing twice is distinguishable from a
duplicate.

Where no attempts remain, or where the implementing stage is not part of
this chain, the chain SHALL stop and SHALL name the tasks that are still
unchecked — the reader is about to take the work over, and a count alone
sends them to open the file.

Where no attempt count is configured, the chain SHALL behave as it did
before: verification leaves the tasks unchecked and the archive step
refuses them.

A failing declared mechanical check SHALL count as such a statement.
It is what unchecks the task in the first place, so treating it as the
end of the chain makes this return unreachable in exactly the case it
exists for. The verifying agent SHALL NOT be invoked when a check has
failed — returning to the implementing stage spends no verifying run.

#### Scenario: A declared check fails and attempts remain

- **WHEN** a declared mechanical check fails at verification and the
  implementing stage has an attempt left
- **THEN** the chain returns to that stage, the verifying agent is not
  invoked, and the reason names the checks that failed

#### Scenario: A declared check fails with no attempt left

- **WHEN** a declared mechanical check fails and no further attempt is
  configured or remaining
- **THEN** the chain stops and names the checks that failed

#### Scenario: Verification leaves work unfinished

- **WHEN** verification completes with tasks unchecked and attempts
  remain
- **THEN** the chain returns to the implementing stage, recording that
  verification is why

#### Scenario: The attempts are used up

- **WHEN** the implementing stage has used every attempt it is allowed
  and tasks are still unchecked
- **THEN** the chain stops and names those tasks

#### Scenario: The chain never ran the implementing stage

- **WHEN** a chain entered at verification leaves tasks unchecked
- **THEN** it stops and names them, rather than running a stage it was
  not asked to run

#### Scenario: Nothing is configured

- **WHEN** no attempt count is configured and verification leaves tasks
  unchecked
- **THEN** the chain continues as before and the archive step refuses

### Requirement: What a stage spent is recorded against that stage

A recorded run SHALL carry the stage it belongs to and the effort the
agent was asked for, where both are known.

Every stage of a chain runs under the chain's own run identifier, so a
record without a stage can say what a change cost and cannot say what any
one stage cost. Effort belongs with it because the same stage on the same
agent at different efforts are not comparable figures.

Both SHALL be optional. A record written before these existed is still a
valid record, and a reader has to be able to tell "not recorded" from
"no stage". Such a record SHALL NOT be given a stage after the fact:
inferring one would invent an attribution that was never observed.

Where a run was stopped because a ceiling was reached, the record SHALL
carry that reason, so that a stopped run can be told from one a person
cancelled without inspecting anything else.

#### Scenario: A chain stage runs

- **WHEN** a stage of a chain completes
- **THEN** its record names that stage and the effort it was asked for

#### Scenario: A run that is not part of a chain

- **WHEN** a single-stage run completes
- **THEN** its record carries no stage, and is not given one

#### Scenario: A record written before this existed

- **WHEN** an older record is read
- **THEN** it reports that its stage is not recorded, rather than being
  attributed to one

#### Scenario: A ceiling stopped the run

- **WHEN** a run was stopped because a configured ceiling was reached
- **THEN** its record carries the reason, and no second record is written
  for the same run

### Requirement: One stage's spend can be bounded by the harness itself

The harness SHALL support an optional ceiling on what a single stage
spends, enforced by the harness rather than by the agent's own command
line.

A spending ceiling cannot interrupt a running stage, because a run's cost
is not known until it ends. This one SHALL therefore be evaluated when a
stage ends and SHALL stop the chain rather than the stage — it prevents
the next overspend, not the one that happened.

Where the chosen agent's own command line can cap an invocation, that cap
SHALL continue to be passed through unchanged. The harness ceiling exists
for the agents whose command line offers none, and where both apply the
lower one binds.

Where a ceiling stops the chain, it SHALL name itself and the value it
was set to rather than blaming the stage that reached it.

#### Scenario: A stage spends more than its ceiling

- **WHEN** a stage completes having reported more than the configured
  per-stage ceiling
- **THEN** the chain stops, naming the ceiling and its value

#### Scenario: The agent's own command line has a cap

- **WHEN** the chosen agent accepts a spending flag
- **THEN** that flag is still passed, and both bounds apply

#### Scenario: The agent reports nothing

- **WHEN** a stage's agent reports no usage at all
- **THEN** the ceiling has nothing to compare and does not stop the chain,
  which is the case the time ceiling exists to cover

### Requirement: One entry starts a run, and it shows what it will do

A change SHALL be started from a single entry, in every host.

That entry SHALL show what the resolved configuration says will happen —
which path will run and which agent will run it — before the run starts.
A surface that acts on a configuration and shows nothing of what it read
leaves a person unable to tell a correct decision from a broken one; here
the two look identical, because the wrong choice mostly changes which
panel is visible.

The entry SHALL pre-select what the configuration resolves to and SHALL
allow it to be changed for this run.

An override of the path SHALL NOT be written to the change's
configuration. A run is not a configuration change, and a later run
behaving differently for a reason nobody recorded is worse than being
asked again.

There SHALL NOT be a second entry that starts the same work by another
route. Where a path was previously reached by its own entry, it SHALL be
offered as a choice within this one.

That entry SHALL show which named configuration is recommended for this
change and the observations behind it, in every host, wherever anything
is known to reason from. A host that can read how much work remains has
something to reason from, whether or not it can read the run history: the
recommendation is built to say what it does not know.

The recommendation SHALL be shown where it can be read, not in a hint
that truncates.

That entry SHALL be rendered where every sentence it has fits. A control
that shows one line per item and cuts the rest without saying so
publishes less than is known, which is the defect this entry exists to
remove: measured from a screenshot on 2026-09-08, every named
configuration's intent ended mid-word in the quick-pick that hosted it.

Both hosts SHALL render it from the same components. Two surfaces
answering one question drift, and the one that shows less is the one a
person keeps seeing.

The named configuration a recommendation proposes SHALL be applicable
from the same place. A recommendation that cannot be acted on is a
remark. Applying one writes the change's configuration, which is a
deliberate act a person takes and is distinct from choosing a path for
one run.

Where nothing is known to reason from, no recommendation SHALL be shown.
A recommendation with no grounds is indistinguishable from a default
presented silently.

Where the resolved configuration has no ceiling that cannot act, the
entry SHALL say so rather than showing nothing. Silence makes "everything
here can act" indistinguishable from "nothing was examined".

#### Scenario: Starting a change whose configuration is assisted

- **WHEN** a run is started for a change resolving to `assisted`
- **THEN** the entry says a single stage will run, names the agent, and
  starts that

#### Scenario: Starting a change whose configuration runs a chain

- **WHEN** a run is started for a change resolving to `semi-autonomous`
  or `autonomous`
- **THEN** the entry says a chain will run and names the agents its
  stages will use

#### Scenario: Choosing a different path for one run

- **WHEN** the offered path is changed before starting
- **THEN** that run takes the chosen path and the change's configuration
  file is left unchanged

#### Scenario: A recommendation is available

- **WHEN** the change's remaining work and previous runs are known
- **THEN** the entry names the configuration it recommends and the
  observations behind it

#### Scenario: Nothing is known to recommend from

- **WHEN** neither the remaining work nor any previous run can be read
- **THEN** no recommendation is shown

#### Scenario: A recommendation where only the remaining work is known

- **WHEN** the host can read how many tasks remain but not the run
  history
- **THEN** a recommendation is shown, and its grounds say there is no
  previous run to go on

#### Scenario: Applying the configuration that was recommended

- **WHEN** the recommended named configuration is applied from the entry
- **THEN** it is written to the change's configuration, and the entry
  reflects what it now resolves to

#### Scenario: A configuration with nothing wrong

- **WHEN** every ceiling in the resolved configuration can act
- **THEN** the entry says so

#### Scenario: The path that used to have its own entry

- **WHEN** the VS Code agent is wanted for this work
- **THEN** it is chosen inside this entry, and no separate command starts
  it

#### Scenario: Where the entry is rendered

- **WHEN** the entry is shown in either host
- **THEN** it is rendered in a surface that shows each configuration's
  full text, rather than in one that truncates it

### Requirement: Applying a named configuration preserves what it does not set

Applying a named configuration to a change SHALL set the keys that
configuration names and SHALL leave every other key in the change's
configuration unchanged.

The writer replaces the file, so a key absent from what is written is
deleted rather than left alone. A person applying a template to get a
cheaper run has not asked for the change's staging allowlist, its
hand-tuned ceilings or its review gate to be removed, and SHALL NOT have
that happen as a side effect.

#### Scenario: A change carrying settings the template does not mention

- **WHEN** a named configuration is applied to a change whose
  configuration contains keys that configuration does not set
- **THEN** the applied keys take the configuration's values and the
  others are still present, unchanged

### Requirement: Named configurations are titled by what is being chosen between

The named configurations SHALL be titled by the effort they ask for, and
each SHALL state its ceilings and where each figure came from.

Effort is what the product can set honestly: every agent declares which
values it accepts. Cost and time are ceilings rather than prices, and a
title carrying one was read as what a run would cost — the confusion a
title naming the effort does not create. The figures remain, stated with
their basis, and are no longer the name.

A configuration SHALL NOT claim a property the product does not control.
Nothing here makes an agent work faster, and nothing here chooses a
model; a title claiming either is the same defect as a configuration
promising behaviour it does not set.

#### Scenario: Comparing the configurations

- **WHEN** the named configurations are offered
- **THEN** each states the effort it asks for, its ceilings, and where
  each figure came from

#### Scenario: The configuration that claims speed

- **WHEN** the named configurations are read
- **THEN** none of them claims speed, because nothing here makes an agent
  work faster — a title claiming it is the same defect as a configuration
  promising behaviour it does not set

#### Scenario: A configuration and the model

- **WHEN** a named configuration is read
- **THEN** it says the model is whichever the workspace already
  configured, rather than leaving that to be inferred from an absence

### Requirement: What runs have cost in this workspace is readable back

The recorded history of runs SHALL be readable as an aggregate over the
workspace: per agent, and per agent and effort together.

Each group SHALL carry how many runs it rests on and how many of those
reported a cost. A median over fifteen samples and a median over two are
different claims, and a figure that does not say which will be believed
equally.

A group resting on fewer runs than the stated threshold SHALL be reported
as such rather than omitted. Omitting it makes "too little is known here"
indistinguishable from "this combination has never run", which are
different facts and lead to different decisions.

Runs recorded against a change that is neither active nor archived SHALL
be excluded. Such a change was deleted, and a deleted change is an
experiment rather than part of the project's record — counting one makes
the project's own testing look like its behaviour.

#### Scenario: An agent with enough recorded runs

- **WHEN** an agent has at least the threshold of paired runs
- **THEN** its group reports the figures together with the number of runs
  and the number that reported a cost

#### Scenario: A combination with too little recorded

- **WHEN** an agent and effort together have fewer runs than the
  threshold
- **THEN** the group is reported as below the threshold, with how many it
  has and how many are needed

#### Scenario: A run against a change that was deleted

- **WHEN** the audit log contains runs against a change that is neither
  in the active changes nor in the archive
- **THEN** those runs are excluded from every aggregate

### Requirement: A per-change stage entry overrides the fields it names

Where a change's configuration sets a stage that the base configuration
also sets, the resolved entry SHALL take the fields the change names and
SHALL inherit the rest from the base. Every field a stage entry may
carry SHALL be merged by this rule, including the custom agent; a field
the merge does not know is a field the override silently loses.

The base file is the default and the change states its differences. A
stage entry replaced outright makes "run this stage at higher effort"
also mean "and forget which model I chose", which no one writing it
intends and nothing reports.

Where the change names a **different agent** for that stage, nothing
SHALL be inherited. A stage's model, effort, budget and custom agent
belong to its agent: effort vocabularies differ between agents, a budget
is denominated in whichever unit its agent reports, and a custom agent
is a definition one CLI reads, so carrying them across a change of agent
produces a configuration its author never wrote.

#### Scenario: A stage override that names only the effort

- **WHEN** the base sets a model for a stage and the change sets only an
  effort for it
- **THEN** the resolved stage keeps the base's model and takes the
  change's effort

#### Scenario: A stage override that names only a custom agent

- **WHEN** the base names an agent for a stage and the change names the
  same agent with a custom agent
- **THEN** the resolved stage carries the custom agent, and it reaches
  the CLI when the stage runs

#### Scenario: A stage override that names a different agent

- **WHEN** the base sets a model, effort and budget for a stage and the
  change names a different agent for it
- **THEN** the resolved stage carries only what the change names

### Requirement: What verify's checks found is recorded

Where `verify` runs a change's declared mechanical checks, their outcome
SHALL be recorded in the audit log: how many ran and how many failed.

This is the only machine-produced statement about the quality of what an
earlier stage produced, and it is computed already. Discarding it leaves
the record able to say what a run cost and unable to say whether the work
was any good.

It SHALL be recorded whether or not the verifying agent runs. A `verify`
whose checks failed does not invoke the agent, so no run entry is written
for it — leaving the case that found the most as the one that left no
trace.

Where a change declares no checks, nothing SHALL be recorded. An entry
saying nothing ran is indistinguishable from one saying nothing failed.

#### Scenario: Checks that all pass

- **WHEN** `verify` runs declared checks and all of them pass
- **THEN** the record says how many ran and that none failed

#### Scenario: Checks that fail

- **WHEN** a declared check fails and the verifying agent is not invoked
- **THEN** the record still says how many ran and how many failed, and
  names the failures

#### Scenario: A change declaring no checks

- **WHEN** a change declares no mechanical checks
- **THEN** nothing is recorded for them

### Requirement: A named configuration names an effort level, not a value

A named configuration SHALL declare where in an agent's own effort range
it sits, and the value SHALL be resolved when it is applied, against the
agent that stage uses.

Effort vocabularies differ between agents: `copilot` accepts seven
values, `claude` five, `codex` four, and five agents accept none. A
configuration storing a literal is wrong for some agent the moment it is
applied, and shipping one the validator would then reject is shipping a
configuration the product refuses.

A named configuration SHALL NOT set a model. Applying one would discard
the model the workspace already chose, no model name it could ship can be
checked against the CLI that will receive it, and which model to use is
not a question a named configuration was asked. Each SHALL say so in its
own text, so a reader is not left to infer it from an absence.

Where two levels resolve to the same value for an agent, or where the
agent accepts no effort at all, that SHALL be reported rather than
presented as configurations that differ.

#### Scenario: The same level against different agents

- **WHEN** the highest level is resolved for an agent accepting five
  values and for one accepting four
- **THEN** each resolves to that agent's own highest value

#### Scenario: An agent that accepts no effort

- **WHEN** a configuration is resolved for an agent with no effort values
- **THEN** it sets no effort, and the surface says the configurations
  differ only in their ceilings for this agent

#### Scenario: Two levels landing on one value

- **WHEN** an agent's range is narrow enough that two levels resolve
  alike
- **THEN** that is reported rather than shown as two distinct choices

### Requirement: Recommendations are drawn from the workspace's own runs

Where the recorded runs support a comparison, the run entry SHALL offer
recommendations drawn from them, each named for what it recommends and
carrying the observation it was drawn from.

A name that states the conclusion — the cheapest, the fastest, the most
likely to finish — is what makes a recommendation usable without reading
the table it came from. The observation beside it is what makes it
arguable.

A recommendation SHALL NOT be offered where its comparison cannot be
made. A superlative over one candidate is not a comparison, and
presenting it as one claims a distinction that was never established.

Where a recommendation is not offered, the reason SHALL say which of
these is so: nothing reported the measure, something reported it but
rests on too few runs, or one candidate is eligible and has nothing to
compare against. "Nothing reported a cost" said of runs that did is a
reason that is false.

Where candidates tie on the measure, all of them SHALL be named. Breaking
a tie arbitrarily presents a fabricated distinction as a finding.

A group resting on fewer runs than the aggregate's threshold SHALL NOT
win a recommendation. The threshold exists because a figure over too few
runs is not an answer, and a superlative is the one place a figure is
stated as an answer rather than as a reading.

#### Scenario: Two agents that reported a cost

- **WHEN** at least two agents have recorded costs above the threshold
- **THEN** the cheapest is recommended by name, with its median cost and
  the runs behind it

#### Scenario: Only one agent reports a cost

- **WHEN** one agent has recorded costs and the others have none
- **THEN** no cost recommendation is offered, and the reason names that
  agent as the only one

#### Scenario: Costs reported by too few runs

- **WHEN** agents have recorded costs but each rests on fewer runs than
  the threshold
- **THEN** no cost recommendation is offered, and the reason says the
  runs are too few, not that none reported

#### Scenario: A tie on the measure

- **WHEN** two agents are equal on the measure being recommended
- **THEN** both are named

#### Scenario: A candidate below the threshold

- **WHEN** the best figure belongs to a group with fewer runs than the
  threshold
- **THEN** it does not win the recommendation

### Requirement: Custom agents are offered where a stage's agent is chosen

The custom agents a workspace defines SHALL be offered for each stage
whose agent accepts one, and the choice SHALL be saved as that stage's
`customAgent`.

A name that was never shown cannot be chosen. The definitions are files
in directories a person may not know the harness reads, and requiring
them to be typed from memory into a configuration file is the same as not
offering them.

The offer SHALL be limited to the definitions the stage's own agent can
take. A definition written for one CLI is not a name the other accepts,
and offering it would produce a configuration the validator refuses.

Where a stage's agent accepts no custom agent, or where the workspace
defines none for that CLI, the surface SHALL say so and where such
definitions are read from, rather than rendering an empty control. An
empty control is a promise of a choice that is not there.

A configured name the discovery no longer finds SHALL remain visible and
be reported as not found. Replacing it silently would edit a
configuration nobody asked to change and hide that a file it depends on
is gone.

#### Scenario: A stage whose agent accepts one

- **WHEN** a workspace defines custom agents and a stage uses an agent
  whose CLI accepts one
- **THEN** the definitions for that CLI are offered for that stage, and
  choosing one saves it as the stage's custom agent

#### Scenario: A stage whose agent accepts none

- **WHEN** a stage uses an agent whose CLI takes no custom agent
- **THEN** no picker is offered for that stage, and the surface says that
  CLI takes none

#### Scenario: A workspace that defines none

- **WHEN** no definition exists for the stage's CLI
- **THEN** the surface says so and names the directories that were read

#### Scenario: A configured name that no longer exists

- **WHEN** a stage names a custom agent the discovery does not find
- **THEN** the name stays selected and is reported as not found, rather
  than being replaced

### Requirement: A stage may run a custom agent its CLI defines

Where an agent's CLI accepts a named custom agent, a stage SHALL be able
to name one, and the name SHALL reach that CLI.

A custom agent is a preset a person has already written for their own
work. Being unable to name one means the harness runs a different agent
than the person would have, for no reason other than that nothing carried
the name.

The custom agents a workspace defines SHALL be discoverable from the
directories the CLIs themselves read. Neither CLI has a command that
lists them, and neither needs one: the definitions are files.

Naming a custom agent for an agent whose CLI accepts none SHALL be
refused rather than dropped. A setting that is accepted and then ignored
is one nothing reads, which is indistinguishable from one that works.

A custom agent name SHALL obey the same shape rule as a model name, and
SHALL be refused at validation where it does not. Both reach the CLI as
the value of a flag, a change's configuration is repository content, and
a value beginning with `-` is one the CLI may read as a second flag.

#### Scenario: A stage naming a custom agent

- **WHEN** a stage names a custom agent for an agent whose CLI accepts
  one
- **THEN** the name is passed to that CLI when the stage runs

#### Scenario: An agent whose CLI accepts none

- **WHEN** a stage names a custom agent for an agent with no such flag
- **THEN** the configuration is refused, naming the agent

#### Scenario: Discovering what a workspace defines

- **WHEN** definitions exist in the directories a CLI reads, in the
  project and for the user
- **THEN** all of them are found, and a name defined in both is reported
  once as the project's

#### Scenario: A name shaped like a flag

- **WHEN** a stage names a custom agent whose value begins with `-`
- **THEN** the configuration is refused, naming the rule

### Requirement: A missing design does not make a proposed change unproposed

Where a chain resumes, a change SHALL be treated as proposed when its
proposal and its task list exist, whether or not it has a design.

A change may deliberately carry no design, and the validator accepts one
that does not. The status command reports such an artifact as ready to be
produced rather than as done, and reading that as an unfinished proposal
sends a chain back to its proposing stage on work that is already
written.

An artifact reported as ready SHALL NOT be read as complete. Ready is
what the command says about an artifact it could produce, including one
nobody has started.

#### Scenario: Resuming a change that has no design

- **WHEN** a chain resumes on a change whose proposal and tasks exist and
  whose design does not
- **THEN** it starts from the implementation, not from proposing

#### Scenario: Resuming a change whose proposal is not written

- **WHEN** a chain resumes on a change with no proposal
- **THEN** it starts at proposing

### Requirement: The run entry shows what runs have cost in this workspace

The entry that starts a run SHALL show what the workspace's recorded runs
have cost and how long they took, per agent, alongside how many runs each
figure rests on.

This is where a person decides what to spend, and the figures answering
"what does this usually cost here" are recorded and were shown nowhere.

Where a group rests on fewer runs than the threshold, the entry SHALL say
so rather than omit the group or present its figures as an answer.

Where nothing has been recorded, the entry SHALL say that statistics are
still accumulating and how much has been read, rather than showing an
empty space. A surface that looks identical before and after a run has
happened gives a reader no way to tell it is working.

#### Scenario: An agent with enough recorded runs

- **WHEN** the run entry is opened in a workspace where an agent has at
  least the threshold of recorded runs
- **THEN** its median cost and duration are shown with the number of runs
  behind them

#### Scenario: An agent that reports no cost

- **WHEN** an agent's runs are recorded but none reported a cost
- **THEN** the entry shows the duration figures and says the cost is not
  reported, rather than showing a cost of zero

#### Scenario: Nothing recorded yet

- **WHEN** no runs have been recorded for this workspace
- **THEN** the entry says so and states how many entries were read

### Requirement: The configuration is edited through the same view in every host

The harness configuration SHALL be editable through the same settings
view in every host, with the same pickers and the same diagnostics.

A host that offers only the file offers none of what the surface knows:
which effort values the chosen agent accepts, which spending field it
honours, which custom agents the workspace defines, and which of the
configured ceilings cannot act. A person editing the file is doing the
validator's work from memory.

The file SHALL remain the configuration and SHALL remain hand-editable,
and the view SHALL name it. A view that replaces a file people already
edit takes away a way of working; one that names it does not.

A refused write SHALL be reported where the edit was made. A form that
cannot say a save was refused is indistinguishable from one that saved.

#### Scenario: Editing the configuration in the editor host

- **WHEN** the harness configuration is opened for editing in VS Code
- **THEN** the settings view is shown, with the same pickers and
  diagnostics the standalone shell shows, and it names the file it edits

#### Scenario: A save the configuration refuses

- **WHEN** a saved configuration is rejected
- **THEN** the reason is shown where the edit was made

### Requirement: The webview can ask its host a question

Where a host renders the shared components without a server, the webview
SHALL be able to ask that host for something and receive an answer or an
error.

A one-way command with a stream of events cannot express a read, and a
surface that reads nothing can only be told what to show — which is why
the settings view could not exist in that host.

A request SHALL name an operation the host offers, never a path, a file
or a function. The host SHALL refuse an operation it does not offer, and
SHALL use its own workspace root rather than one named in the message.

#### Scenario: Asking for the resolved configuration

- **WHEN** the webview asks its host for something it offers
- **THEN** the answer comes back against that request

#### Scenario: Asking for something the host does not offer

- **WHEN** a request names an operation the host does not offer
- **THEN** it is refused, and nothing is read or written

### Requirement: A run can be asked for at a time, and reports what became of it

A run SHALL be requestable for a time rather than for now, from the same
entry that starts one immediately.

Where the application is open at that time, the run SHALL start. Where it
is not, the run SHALL start when the application is next opened, and the
surface SHALL say how late it is. Opening the application SHALL be
enough: a schedule that waits for a further action after the open is one
that did not start at the next open.

A schedule that does not happen SHALL NOT be indistinguishable from one
that does. The entry SHALL say, before it is made, that it depends on the
application being open, and SHALL say afterwards when a run started later
than it was asked for.

The path chosen when the run was asked for SHALL be the path it takes
when it starts. Where that path is no longer offered for the change, the
surface SHALL ask for a choice and say why.

An entry SHALL be consumed only once the run it names has been opened.
Where opening fails, the entry SHALL remain and the failure SHALL be
reported as a failure to open the run, not as a failure to read the
schedule.

A time already past SHALL be refused where it is entered rather than
accepted and fired at once.

Where several runs are due together, one SHALL start and the rest SHALL
be reported as waiting. A second mutating run is refused by the workspace
lease, and presenting that refusal as an error would describe a fault
that is not one.

A schedule naming a change that no longer exists SHALL be dropped, and
the drop SHALL be reported. A schedule naming a change that has since
been archived SHALL be dropped as archived, distinctly: its work is done,
and a run against it is not one anybody asked for.

What to do with a schedule SHALL be decided in one place, in core; a host
SHALL perform the effects it is handed and decide nothing about the
schedule itself.

A run dialog that opens without the person's action SHALL be announced,
and what the schedule did SHALL be readable from any part of the surface.

#### Scenario: A run scheduled while the application stays open

- **WHEN** a run is scheduled for a time and the application is open then
- **THEN** it starts at that time, on the path that was chosen

#### Scenario: A run whose time passed while nothing was open

- **WHEN** the application is opened after a scheduled time has passed,
  and nothing else is done
- **THEN** the run starts and the surface says how late it is

#### Scenario: A time in the past

- **WHEN** a time earlier than now is entered
- **THEN** it is refused where it was entered

#### Scenario: Two runs due at once

- **WHEN** two scheduled runs come due together
- **THEN** one starts and the other is reported as still waiting

#### Scenario: A schedule for a change that was deleted

- **WHEN** a scheduled run names a change that is neither active nor
  archived
- **THEN** the entry is dropped and the drop is reported

#### Scenario: A schedule for a change that was archived

- **WHEN** a scheduled run names a change that was archived after it was
  scheduled
- **THEN** the entry is dropped, the report says it was archived, and a
  run due behind it starts on the same reading

#### Scenario: The run cannot be opened

- **WHEN** a due run's configuration cannot be resolved
- **THEN** the entry remains in the schedule and the surface says the run
  could not be opened, and why

#### Scenario: A dialog that opened by itself

- **WHEN** a scheduled run opens the run dialog
- **THEN** the dialog is announced and takes focus, and the schedule's
  message is readable from any tab

### Requirement: What the verifying stages found is readable per agent

What a change's verifying stages found SHALL be readable back per agent,
beside what the runs cost, where the agent is the one whose work the
checks covered.

The audit log records how many checks a verifying stage ran and how many
failed. An agent that is cheap and fails its checks is not the cheap one,
and a surface that reports only cost invites exactly that reading.

A checks entry SHALL record the agent whose work it examined. The entry
is written by the runner, not by an agent, and grouping by its writer
yields one group that names no agent. An entry recorded before that
field existed SHALL be counted and reported as such, not charged to a
group.

A checks entry SHALL NOT be counted as a run anywhere runs are counted.
It is a fact about a run.

Each group SHALL carry how many verifying stages it rests on, and a group
resting on fewer than the stated threshold SHALL be reported as such
rather than omitted. Omitting it makes "too little is known here"
indistinguishable from "this agent never fails".

Where nothing has been recorded, the surface SHALL distinguish a log with
no runs from a log whose runs never reached a verifying stage. They are
different facts and only one of them is answered by running something.

Runs recorded against a change that is neither active nor archived SHALL
be excluded, by the same rule the cost figures apply.

#### Scenario: An agent whose checks have failed

- **WHEN** verifying stages have recorded what their checks found
- **THEN** each group names the agent whose work was checked, with its
  stages, failures and check counts

#### Scenario: An entry recorded before the agent was named

- **WHEN** a checks entry carries no checked agent
- **THEN** it is counted and reported as recorded before the agent was
  named, and no group is charged with it

#### Scenario: A checks entry beside a run

- **WHEN** one chain run performed an apply and a verify with declared
  checks
- **THEN** the run count everywhere is one

#### Scenario: Too few stages to read as a rate

- **WHEN** an agent has fewer verifying stages than the threshold
- **THEN** it is shown and reported as resting on too few

#### Scenario: A log whose runs never verified

- **WHEN** runs are recorded but none reached a verifying stage
- **THEN** the surface says so, distinctly from having no runs at all

### Requirement: Applying a named configuration to a change writes one file from every surface

Where a named configuration is applied to a change, the override written
SHALL be the same whichever surface applied it, and SHALL be produced by
one function in core.

A configuration's effort belongs to the agent the stage will run, which
for a stage the override does not name is the base's. A surface that
resolves against the override alone gives no stage an effort and reports
a reason that is not the reason.

The surface SHALL say which stages were given an effort and which agents
accept none. "No agent on screen accepts an effort" SHALL be said only
where that is so.

#### Scenario: The same configuration from two surfaces

- **WHEN** a named configuration is applied to a change from the run
  dialog, and the same one from the settings view
- **THEN** the change's override file is identical

#### Scenario: An override naming no stage

- **WHEN** a named configuration is applied to a change whose override
  names no stage, and the base's agents accept an effort
- **THEN** each stage is written with the base's agent and the resolved
  effort, and the message names them

### Requirement: A configuration's words match what it resolves to

A named configuration's description of the effort it asks for SHALL be
true for every registered agent it can be applied to, and the reference
SHALL show the resolved value per agent.

The levels resolve to positions in an agent's range by thirds, chosen so
that four levels stay distinct over four values. A word such as "middle"
describes a different arithmetic, and a reader of an agent with seven
values is told one thing and given another.

#### Scenario: Reading the balanced configuration for an agent with seven values

- **WHEN** the reference is read for the balanced configuration and an
  agent accepting seven effort values
- **THEN** it shows the value the resolver produces, and the
  configuration's own text does not contradict it

### Requirement: A setting offers only values it would accept

Where a surface offers a choice of values for a setting, it SHALL offer
only those the same surface would accept when saved, at the scope the
control belongs to.

A value the control offers and the save refuses is worse than an absent
control: the reader makes a choice, is told it was wrong, and learns
nothing about why it was offered. The refusal already exists in the
writer; the offer is what has to agree with it.

Each value SHALL be named by what choosing it does. A label that
describes the implementation's history rather than the value's effect
gives the reader nothing to choose between, and goes stale without
anything noticing.

#### Scenario: A value valid only for a change

- **WHEN** the workspace-level section of the settings view offers
  autonomy levels
- **THEN** it offers only the levels a workspace-level file accepts

#### Scenario: The same value where it is valid

- **WHEN** the per-change section offers autonomy levels
- **THEN** it offers every level a change's own file accepts

#### Scenario: What a level is called

- **WHEN** an autonomy level is offered
- **THEN** its label says what running under it does

### Requirement: A delegated item can be run by the agent it names

Where a task names an agent and is not yet done, the surfaces that list
it SHALL be able to run that agent against that item, and the run SHALL
go through the same allowlist, working-directory sandbox and audit log
as every other agent run.

A name that nothing dispatches is a label. The marking exists so the
work reaches somebody other than the person reading the list, and until
something acts on it, a person drives every run by hand.

One item SHALL be run per request, asked for deliberately. Fanning out
across a change's items is a different question, with a different
argument about isolation.

A change MAY state which agent a particular task uses, in its own
configuration file, keyed by the task's number. That statement SHALL
take precedence over the task text. It SHALL NOT be settable for the
workspace: a numbered task belongs to one change, so the same statement
made workspace-wide is about a task in some other change.

Where the file and the task text name different agents, both SHALL be
reported rather than one silently winning. Where the file names a task
number no open line carries, that SHALL be reported as unmatched.

An item marked as needing a person SHALL NOT be offered a run. An item
naming an agent this build does not recognise SHALL be refused before
anything is started, naming the id.

The audit entry for such a run SHALL carry the change and the task
number.

#### Scenario: Running an item that names an agent

- **WHEN** an open item naming a registered agent is run from either
  host
- **THEN** that agent runs against that item, under the same
  constraints as any stage, and the audit entry names the change and
  the task

#### Scenario: An item that waits on a person

- **WHEN** an open item is marked as needing a person
- **THEN** no run is offered for it

#### Scenario: An agent the registry does not carry

- **WHEN** an item names an agent id this build does not recognise
- **THEN** the run is refused before anything is started, naming the id

#### Scenario: The file and the text disagree

- **WHEN** a change's configuration names one agent for a task and the
  task text names another
- **THEN** the configuration is used and both are reported

#### Scenario: A configured task that does not exist

- **WHEN** a change's configuration names a task number no open line
  carries
- **THEN** it is reported as unmatched

### Requirement: An item cannot be closed by being ticked in silence

Where an agent runs against a delegated item, the item's text SHALL be
read before the run and compared after. An item that became ticked
while saying nothing it did not say before SHALL have the tick
reverted, and the run SHALL be reported as refused, naming why.

An agent asked to confirm that something works will confirm that it
works. The evidence rule is what makes a delegated item closeable, and
the cheapest way to break it is to tick the box and write nothing.

What this checks SHALL be stated where the outcome is shown. Nothing
mechanical can judge whether written evidence is true, and a gate that
passed SHALL NOT be presented as a verified claim.

#### Scenario: A tick with nothing written

- **WHEN** a run leaves an item ticked and its text otherwise unchanged
- **THEN** the tick is reverted and the refusal says why

#### Scenario: A tick with evidence written

- **WHEN** a run leaves an item ticked and its text carrying more than
  it did
- **THEN** the item is left as written, and the surface says only that
  something was recorded, not that it was checked

### Requirement: A change may declare additional steps in its chain

A change's own harness configuration MAY declare steps that the chain
runs in addition to its fixed stages.

Each declared step SHALL name an entry in a registry the core owns, and
SHALL state its position as being before or after one fixed stage —
exactly one of the two, naming exactly one stage.

A declaration SHALL NOT name something to execute. The name selects a
behaviour this system implements; a configuration file supplies data and
never supplies a command, an argument vector, or a path to run.

Steps SHALL be declarable only in a change's own configuration. A
workspace-wide declaration is a statement about changes it knows nothing
about, and SHALL be refused with its own error.

#### Scenario: A step declared before a stage

- **WHEN** a change declares a step positioned before a fixed stage
- **THEN** the chain runs that step immediately before that stage

#### Scenario: A step naming nothing the registry has

- **WHEN** a declaration names a step the registry does not contain
- **THEN** the configuration is refused, and the message lists the names
  that are valid

#### Scenario: A declaration stating both positions, or neither

- **WHEN** a declaration states both a before and an after position, or
  states neither
- **THEN** the configuration is refused

#### Scenario: A workspace-wide declaration

- **WHEN** the workspace-wide harness configuration declares steps
- **THEN** it is refused, distinctly from other configuration errors

### Requirement: The fixed stages stay fixed

A declaration SHALL NOT remove a fixed stage, replace one, or change the
order they run in. It inserts only.

A chain's fixed sequence is what lets somebody who has watched one
change's run read another's. A change able to delete a stage would
produce a transcript that means something different from every other
transcript, and could not be read without first opening that change's
configuration.

#### Scenario: Every fixed stage still runs

- **WHEN** a change declares steps and its chain runs
- **THEN** each fixed stage the chain would have run still runs, in the
  order it always did

### Requirement: A declared step is a part of the chain's own timeline

A step SHALL be reported through the same events, in the same sequence,
as the stages around it — announced when it starts and reported when it
finishes, naming itself.

A surface that renders a chain SHALL NOT need to recognise a step to
render the run coherently.

A step that fails SHALL end the chain, in the same way a failing stage
does.

#### Scenario: Watching a chain that has a declared step

- **WHEN** a chain with a declared step runs
- **THEN** the step appears in the transcript between the stages it was
  declared between, naming itself

#### Scenario: A step that does not succeed

- **WHEN** a declared step fails
- **THEN** the chain ends, and the reason states which step failed and
  what it was doing

### Requirement: A chain may wait for another change to land

The registry SHALL provide a step that waits until a named change is no
longer active in the workspace.

The wait SHALL have a bounded maximum duration. Exceeding it SHALL fail
the chain with a reason naming the change that was waited for and how
long the wait was given.

A change SHALL NOT be able to wait for itself.

#### Scenario: The awaited change lands

- **WHEN** a chain reaches a step waiting on another change, and that
  change is archived while it waits
- **THEN** the wait ends and the chain continues to the next stage

#### Scenario: The awaited change has already landed

- **WHEN** the change a step waits on is already not active when the step
  begins
- **THEN** the step finishes without waiting

#### Scenario: The wait runs out

- **WHEN** the awaited change has not landed within the wait's maximum
  duration
- **THEN** the chain fails, naming the change and the duration

#### Scenario: A change waiting on itself

- **WHEN** a change declares a wait naming itself
- **THEN** the configuration is refused

### Requirement: Time spent waiting is not time spent running

The duration of a step that waits SHALL NOT count towards a chain's
configured run-time ceiling, and SHALL NOT count as spending against a
budget.

A chain waiting for something outside itself is not consuming anything,
in the same way a chain paused at a checkpoint is not. Counting it would
stop chains that are behaving exactly as they were configured to.

#### Scenario: A long wait under a run-time ceiling

- **WHEN** a chain with a run-time ceiling waits longer than that ceiling
  at a declared step, then continues
- **THEN** the ceiling is not reached by the waiting, and the chain
  proceeds

### Requirement: A declaration is checked before the chain starts

Every declared step SHALL be resolved before the first stage runs: its
name, its position, and whatever that entry requires of it.

A run whose declaration cannot be resolved SHALL be refused having
invoked no agent, rather than failing when the chain reaches the step.

Whether the thing a step waits for exists SHALL NOT be part of that
check. It may legitimately not exist yet — that is what the wait is for.

#### Scenario: A misspelled step name in a chain that would run agents first

- **WHEN** a change declares an unrecognised step positioned late in the
  chain
- **THEN** the run is refused before the first stage, and no agent was
  invoked

#### Scenario: Waiting on a change that has not been proposed yet

- **WHEN** a step names a change that does not exist in the workspace
- **THEN** the run is not refused for that reason

### Requirement: A chain does not start for a change its own declaration holds

Where a change declares that it is blocked by another change, and that
other change is still active, a chain for it SHALL be refused before its
first stage.

The refusal SHALL name the blocker. The remedy is not a setting: it is
to land that change or to remove the declaration, and the message SHALL
say which change is being waited for so either can be done.

A blocker that has been archived SHALL NOT hold anything. That is what
the declaration has always meant.

A declaration naming a change that does not exist SHALL NOT hold
anything either. That is a fault in the declaration, reported as one by
the check that validates relations, and holding the run on it would hide
the fault behind a refusal that reads as a schedule.

#### Scenario: A blocker that has not landed

- **WHEN** a chain is requested for a change declaring a blocker that is
  still an active change
- **THEN** the run is refused before the first stage, naming the blocker,
  and no agent was invoked

#### Scenario: A blocker that has landed

- **WHEN** the declared blocker has been archived
- **THEN** the run starts

#### Scenario: A declaration naming nothing that exists

- **WHEN** a change declares a blocker that is not a change of this
  repository
- **THEN** the run is not refused for that reason

### Requirement: A declared blocker is not a validation failure

A change that declares an unmet blocker SHALL remain valid.

The declaration states a plan, and a plan not yet carried out is not a
defect. Whether the repository validates and whether a run may start now
are different questions, and only the second one is answered by the
declaration.

#### Scenario: Validating a repository holding a blocked change

- **WHEN** the relations of a repository containing a change with an
  unmet blocker are checked
- **THEN** that change is not reported as invalid

### Requirement: A blocked change cannot be started by asking differently

There SHALL be no option that starts a chain for a change whose declared
blocker has not landed.

The declaration is a sentence its author wrote in a file under version
control. An option to override it would move that decision out of the
repository and into an invocation nobody reviews.

#### Scenario: Asking again

- **WHEN** a chain for a blocked change is requested in any way this
  system offers
- **THEN** it is refused

### Requirement: A common configuration goal has a short path

A goal a person configures the harness for SHALL have a document that
states the goal, the file it edits, at most two steps, and the object
those steps write — linking the reference documentation for accepted
values rather than restating them.

Reference documentation organised by configuration key answers "what
does this key accept". It does not answer "what do I set to get this
outcome", and a person assembling that answer out of four keys in a
reference is the cost that grows with every setting added.

A goal that cannot be expressed in two steps SHALL be recorded as such,
naming what stands in the way, rather than written up as a longer path.
The length is evidence about the configuration, not about the document.

#### Scenario: A goal that fits in two steps

- **WHEN** a common goal can be reached by editing one file in at most
  two steps
- **THEN** a document states the goal, that file, those steps and the
  object written, and links the reference for the detail

#### Scenario: A goal that does not fit

- **WHEN** a common goal cannot be reached in two steps
- **THEN** the goal and the obstacle are recorded, and no page is
  written that pads the path to make it fit

### Requirement: What a CLI cannot be given is stated with its reason

Where an agent's own CLI cannot accept a configuration this harness
offers for other agents, the documentation of that configuration SHALL
say so, with the date the CLI's published behaviour was read and the
mechanism that CLI uses instead.

"Unsupported" alone invites the same question to be asked and
re-derived. A statement that names what the CLI does document — a
directory it reads, a selection syntax it accepts — is what lets a
future reader tell whether the situation has changed.

#### Scenario: An agent's CLI has no flag for a capability offered to others

- **WHEN** an agent's CLI reads custom agent definitions but documents
  no flag selecting one for a single non-interactive run
- **THEN** the documentation states the directories it reads, the
  selection mechanism it does document, the date read, and that this is
  why no custom agent can be offered for it

### Requirement: The implementing stage is told to tick what it finished

The implementing stage's instruction SHALL tell the agent to tick each
task in `tasks.md` as soon as that task's own verification has passed,
never before the task is done, and to leave a task it could not do
unticked and report why.

This SHALL be part of the product's own instruction, and SHALL NOT depend
on a project's configured rules.

#### Scenario: A repository with no rules about tasks

- **WHEN** a chain runs in a repository whose configuration states no
  rules about tasks
- **THEN** the implementing agent is still told to tick each task it
  finished

### Requirement: Verification ticks what it confirms

The verifying stage's instruction SHALL tell the agent to tick an
unticked task whose verification it has confirmed itself, and to untick
a ticked task whose verification does not hold.

It SHALL state that a task whose effect is not a changed file is
confirmed by checking that effect, and that leaving no changed file is
not by itself a reason to leave a task unticked.

It SHALL tell the agent never to tick a task marked `**Human-only**` or
`**Delegated to …**`.

#### Scenario: Work done and not ticked

- **WHEN** the implementing run did a task without ticking it, and the
  verifying agent confirms that task's verification
- **THEN** the verifying agent is permitted to tick it

#### Scenario: A task whose effect is a command

- **WHEN** a task requires a command to pass and changed no file
- **THEN** the verifying agent is told to confirm it by checking that
  effect rather than to leave it unticked for want of a file

#### Scenario: A task for a person or another agent

- **WHEN** a task is marked `**Human-only**` or `**Delegated to …**`
- **THEN** the verifying agent is told not to tick it

### Requirement: An implementing run that ticked nothing is named

When an implementing run completes having changed files, and no task in
`tasks.md` went from unticked to ticked during it, the chain SHALL say so
as that stage ends.

It SHALL NOT fail the stage or stop the chain for it.

#### Scenario: Files changed, nothing ticked

- **WHEN** the implementing stage completes with a non-empty change to
  the working directory and the same number of ticked tasks as before it
- **THEN** the chain reports that the stage changed files and ticked no
  task, and continues to verification

#### Scenario: Nothing changed

- **WHEN** the implementing stage completes having changed no file
- **THEN** no such report is made

### Requirement: A refused archive names the unticked tasks

When the archive step refuses a change because tasks are unticked, the
refusal SHALL name those tasks, not only count them.

#### Scenario: Two tasks left

- **WHEN** a chain reaches archive with two tasks unticked
- **THEN** the refusal names both

