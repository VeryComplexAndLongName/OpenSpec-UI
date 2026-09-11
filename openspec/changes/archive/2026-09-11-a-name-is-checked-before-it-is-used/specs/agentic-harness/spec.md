## MODIFIED Requirements

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
