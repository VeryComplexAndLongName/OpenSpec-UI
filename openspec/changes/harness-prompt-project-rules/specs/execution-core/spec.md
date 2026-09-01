## ADDED Requirements

### Requirement: A run's prompt carries the project's rules for the work being done

The prompt built for an agent run SHALL include the project's own
instructions for the artifact the run works on, in addition to the
change's content. The rules SHALL be presented as rules the run is
expected to follow, distinctly from the change's files, which remain
reference data.

When those instructions cannot be obtained, the run SHALL proceed with
the prompt it would otherwise have built, rather than failing.

#### Scenario: Rules are available

- **WHEN** a prompt is built for a run whose command kind maps to an
  artifact, and the project's instructions for that artifact can be
  obtained
- **THEN** the prompt contains them in their own section, labelled as
  rules to follow and separate from the change's content

#### Scenario: Rules cannot be obtained

- **WHEN** the project's instructions cannot be obtained
- **THEN** the prompt is built exactly as it would have been without
  them, with no empty section, and the run proceeds

#### Scenario: An adapter that cannot carry the full prompt

- **WHEN** an adapter must fall back to a shortened prompt because the
  full one exceeds what it can deliver
- **THEN** the shortened prompt names how the agent can obtain the
  project's rules itself, rather than omitting them silently
