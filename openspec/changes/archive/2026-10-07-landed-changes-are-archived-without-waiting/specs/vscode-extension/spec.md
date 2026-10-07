## ADDED Requirements

### Requirement: The extension starts in an OpenSpec workspace

The extension SHALL activate in any workspace that contains
`openspec/changes`, `openspec/config.yaml` or `openspec/project.md`,
whether or not its view is opened, so that the workspace sweep runs there.

#### Scenario: A window with the view closed

- **WHEN** VS Code opens a repository with an `openspec/` project and the
  OpenSpec Workbench view is never opened
- **THEN** the extension is active and the sweep runs on its interval