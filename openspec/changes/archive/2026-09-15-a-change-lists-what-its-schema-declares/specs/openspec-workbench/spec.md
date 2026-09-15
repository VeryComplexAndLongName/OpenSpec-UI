## MODIFIED Requirements

### Requirement: Workbench exposes the complete OpenSpec workspace

The system SHALL provide hierarchical navigation to configuration, active and
archived changes, canonical specs, and the artifacts of each change without
requiring users to locate files manually. When the Processes dashboard opens
from VS Code, it SHALL initialize its workspace and change paths from the
current host context and SHALL use VS Code semantic theme colors.

A change's artifacts SHALL be the ones its OpenSpec schema declares, in the
order the schema declares them.
- **Which schema.** The system SHALL resolve the change's schema as the
  OpenSpec CLI does: the `schema` of the change's `.openspec.yaml`, then of
  `openspec/config.yaml`, and otherwise `spec-driven`.
- **Where the schema file is read from.** The project's
  `openspec/schemas/<name>/schema.yaml`, then the user's OpenSpec schema
  directory, then the built-in `spec-driven`.
- **Which files.** An artifact's files SHALL be the ones its `generates` path
  or glob matches. A declared single-file artifact with no file SHALL be
  listed as missing.
- **Delta specs.** A delta spec SHALL be found at any depth under the change's
  `specs/` directory, and named by its capability path under `specs/`.
- **No CLI process.** Discovering a change's artifacts SHALL NOT start the
  OpenSpec CLI.

When the change's schema cannot be read, because it is not found, its file
does not parse, or it declares no artifacts, the system SHALL list the
built-in `spec-driven` artifacts and SHALL say why.

#### Scenario: User expands an active change

- **WHEN** the user expands a change that uses the `spec-driven` schema in the
  Workbench
- **THEN** proposal, design, tasks, and delta specs are shown
- **AND** selecting an artifact opens it in a native VS Code editor

#### Scenario: A delta spec inside an area folder

- **WHEN** a change's delta spec is at `specs/web/dashboard-foundation/spec.md`
- **THEN** that delta spec is shown as present and named
  `web/dashboard-foundation`
- **AND** no delta spec named `web` is shown as missing

#### Scenario: A custom schema declares another artifact

- **WHEN** a change uses a project schema that declares an `adr` artifact
  generating `adr.md`, and the change has `adr.md`
- **THEN** the ADR is shown among the change's artifacts, in the position the
  schema declares it
- **AND** the proposal, design, tasks, and delta specs the schema also declares
  are shown as before

#### Scenario: A declared artifact has no file yet

- **WHEN** a change's schema declares `design.md` and the change has none
- **THEN** Design is shown as missing

#### Scenario: The change's schema cannot be read

- **WHEN** a change names a schema that is found in neither the project, the
  user schema directory, nor the built-in schemas
- **THEN** the change's `spec-driven` artifacts are shown
- **AND** the change says that its schema was not found, and names it

#### Scenario: A collection does not exist

- **WHEN** archive or canonical specs have not been created
- **THEN** the view explains why it is empty
- **AND** offers an applicable lifecycle or documentation action

#### Scenario: User opens the Processes dashboard from Changes

- **WHEN** the user invokes Open Process Dashboard from the Changes view title
- **THEN** Workspace root contains the active VS Code workspace path
- **AND** Change directory contains that workspace's `openspec/changes` path

#### Scenario: Existing dashboard receives new context

- **WHEN** the dashboard is already open and is revealed for another change
- **THEN** its workspace and change-directory fields update to the supplied host
  context
- **AND** stale local-storage values do not override the host context

#### Scenario: VS Code color theme changes

- **WHEN** VS Code renders the dashboard in a light, dark, high-contrast, or
  custom color theme
- **THEN** dashboard surfaces, text, controls, borders, and focus indicators use
  VS Code semantic theme variables
- **AND** the standalone browser palette is unchanged
