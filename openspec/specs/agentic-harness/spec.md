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
accepted in a per-change `harness.json`.

#### Scenario: Global file attempts to set agent-sufficient

- **WHEN** `openspec/agent-harness.json` sets `reviewGate.mode:
  "agent-sufficient"`
- **THEN** the system reports a clear validation error and does not
  resolve or apply that value

#### Scenario: Per-change file sets agent-sufficient

- **WHEN** a per-change `harness.json` sets `reviewGate.mode:
  "agent-sufficient"`
- **THEN** the resolved configuration for that change uses
  `agent-sufficient`, without affecting any other change's resolved
  configuration

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

