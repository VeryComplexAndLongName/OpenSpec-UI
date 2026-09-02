## ADDED Requirements

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
