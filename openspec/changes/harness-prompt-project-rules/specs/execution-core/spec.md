## ADDED Requirements

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
