## MODIFIED Requirements

### Requirement: Extension provides OpenSpec utility command entry points
The extension SHALL provide command palette actions for:
- launching `openspec view` in an integrated terminal
- opening parsed change details from `showChange(...)`
- opening parsed strict validation summary from `validateChange(...)`
- opening parsed `openspec view` summary alongside terminal launch

#### Scenario: User runs OpenSpec validation action
- **WHEN** user picks a change from QuickPick in validation action
- **THEN** extension executes strict validation through core wrapper
- **AND** opens a readable Markdown summary document instead of raw CLI text

#### Scenario: User runs openspec view from command palette
- **WHEN** user executes `openspec-ui.openCliView`
- **THEN** extension starts interactive `openspec view` in integrated terminal
- **AND** opens a parsed markdown overview of changes/specs as a visual companion
