## ADDED Requirements

### Requirement: The sprint report command says it is reading

The sprint report command SHALL show a progress notification, naming how
many changes it reads, while it builds the report.

#### Scenario: A report over many changes

- **WHEN** the user runs the sprint report command over many changes
- **THEN** a notification says the command is reading them until the save
  dialog opens
