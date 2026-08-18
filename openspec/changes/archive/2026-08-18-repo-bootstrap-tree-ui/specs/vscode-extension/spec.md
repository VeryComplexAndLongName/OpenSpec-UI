## ADDED Requirements

### Requirement: Changes tree surfaces repository-setup actions

The "Changes" tree view SHALL show a "Repository Setup" node, always
present regardless of workspace initialization state, positioned
immediately after "OpenSpec Configuration". Expanding it SHALL list the
three repository-bootstrap actions ("Generate Agent Instructions",
"Configure Dependabot", "Generate Path-Scoped Copilot Instructions") as
child items; selecting one SHALL run the corresponding existing command
(`openspec-ui.generateAgentInstructions`,
`openspec-ui.configureDependabot`, `openspec-ui.generateSubtypeInstructions`)
unchanged, including its project-type `QuickPick` prompt. The "Archive"
tree SHALL NOT show this node.

#### Scenario: Repository Setup node is always visible

- **WHEN** the user opens the "Changes" tree, regardless of whether any
  changes exist
- **THEN** a "Repository Setup" node is shown immediately after "OpenSpec
  Configuration"

#### Scenario: Selecting a repository-setup action runs its command

- **WHEN** the user expands "Repository Setup" and selects "Generate
  Agent Instructions"
- **THEN** the `openspec-ui.generateAgentInstructions` command runs,
  including its existing project-type prompt

#### Scenario: Archive tree has no Repository Setup node

- **WHEN** the user opens the "Archive" tree
- **THEN** no "Repository Setup" node is shown
