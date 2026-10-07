## ADDED Requirements

### Requirement: The extension tells agents how work is done here

"Initialize OpenSpec" SHALL write the workflow rules once OpenSpec is
initialized, and "Write Agent Workflow Rules" SHALL write them on demand.
Where a file without the section exists, the extension SHALL ask before
adding to it. "Create OpenSpec Change" and "Create Change Template" SHALL
make the change in its own working directory and say where.

#### Scenario: Initialize where OpenSpec wrote AGENTS.md

- **WHEN** a person initializes OpenSpec and `openspec init` wrote
  `AGENTS.md`
- **THEN** the extension asks whether to add the rules to its end, and
  writes them into `CLAUDE.md` either way