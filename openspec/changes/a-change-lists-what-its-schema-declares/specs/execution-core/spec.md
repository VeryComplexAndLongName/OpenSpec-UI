## MODIFIED Requirements

### Requirement: Repository contents are data, not executable instructions

The system SHALL pass repository file content (change proposals, issue text,
etc.) to agents strictly as context data. The system SHALL NOT allow this
content to influence command allowlist, execution cwd, or which command is
actually run.

When preparing that context for a `plan`/`review`/`implement` run, the system
SHALL read and embed the content of every existing file the OpenSpec schema of
the change named by the run's `changeDir` declares. That includes delta specs
at any depth under the change's `specs/` directory. The system SHALL skip any
declared file that does not exist, rather than sending an otherwise-empty
prompt, and SHALL embed no file whose resolved path lies outside that
`changeDir`.

The prepared context SHALL explicitly instruct the agent to work only within
the named `changeDir` and not read or modify files under any other
`openspec/changes/<id>/` directory.

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

#### Scenario: A nested delta spec and a schema's own artifact are embedded

- **WHEN** a run is prepared for a change whose schema declares an `adr`
  artifact generating `adr.md`, and the change has `adr.md` and a delta spec
  at `specs/web/dashboard-foundation/spec.md`
- **THEN** the prepared prompt contains the content of both files

#### Scenario: A declared file that resolves outside the change is not embedded

- **WHEN** a file the change's schema declares resolves, through a link, to a
  path outside the run's `changeDir`
- **THEN** the prepared prompt does not contain that file's content

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
