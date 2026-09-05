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

