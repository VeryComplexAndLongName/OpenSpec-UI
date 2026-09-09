## ADDED Requirements

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
