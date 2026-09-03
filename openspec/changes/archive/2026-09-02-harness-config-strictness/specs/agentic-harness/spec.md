## ADDED Requirements

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
