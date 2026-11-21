# workbench-agent-defaults Specification

## Purpose
Define the repository's primary Workbench agent assignments and preserve explicit agent selection.
## Requirements
### Requirement: Repository agent stages default to Codex ACP

The active repository Workbench configuration SHALL assign codex-cli-acp to migrated Claude assignments and to otherwise unassigned propose, review, apply and verify stages. A migrated assignment SHALL use a model supported by Codex or the model configured by Codex when no model is specified. Other explicit agent choices SHALL remain selectable.

#### Scenario: A Claude assignment is migrated

- **WHEN** a stage uses a Claude adapter or a Claude model
- **THEN** its replacement SHALL use codex-cli-acp without a Claude model identifier
- **AND** supported effort and repository-wide workflow settings SHALL be preserved

#### Scenario: Another agent is already selected

- **WHEN** a stage explicitly selects another supported agent
- **THEN** that selection SHALL remain in the configuration

### Requirement: Shared initial selection uses Codex ACP

An agent command without an explicit agent SHALL use codex-cli-acp. Repository setup SHALL prefer Codex ACP when the stage has no selection and that agent is available. An existing explicit selection SHALL take precedence.

#### Scenario: New repository setup with Codex installed

- **WHEN** repository setup offers installed agents for an unconfigured stage
- **THEN** Codex ACP SHALL appear first
- **AND** claude-cli and claude-cli-acp SHALL remain available with their supported settings

#### Scenario: Existing explicit selection

- **WHEN** the stage already selects a supported agent
- **THEN** setup SHALL show that agent first
