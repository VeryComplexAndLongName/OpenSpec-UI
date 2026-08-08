# OpenSpec Workbench Dashboard Delta

## MODIFIED Requirements

### Requirement: Workbench exposes the complete OpenSpec workspace

The system SHALL provide hierarchical navigation to configuration, active and
archived changes, canonical specs, and proposal, design, tasks, and delta spec
artifacts without requiring users to locate files manually. When the Processes
dashboard opens from VS Code, it SHALL initialize its workspace and change
paths from the current host context and SHALL use VS Code semantic theme colors.

#### Scenario: User expands an active change

- **WHEN** the user expands a change in the Workbench
- **THEN** proposal, design, tasks, and delta specs are shown
- **AND** selecting an artifact opens it in a native VS Code editor

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
