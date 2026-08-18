## ADDED Requirements

### Requirement: Changes and Archive trees offer whole-Change rollback

A "Rollback Change" action SHALL be available on a Change item in either
the "Changes" or "Archive" tree view. Selecting it, when at least one
rollback-eligible process exists for that Change, SHALL show a
confirmation naming the affected file and process counts before
proceeding; when no rollback-eligible process exists, the system SHALL
report that instead of prompting for confirmation.

#### Scenario: Rollback from the Changes tree

- **WHEN** the user selects "Rollback Change" on an active Change with
  rollback-eligible processes
- **THEN** a confirmation shows the affected file and process counts
- **AND** confirming restores those files and refreshes the trees

#### Scenario: Rollback from the Archive tree

- **WHEN** the user selects "Rollback Change" on an archived Change with
  rollback-eligible processes
- **THEN** the same confirmation and restore behavior applies, unmodified
  by archive status

#### Scenario: No rollback-eligible processes

- **WHEN** the user selects "Rollback Change" on a Change with no
  rollback-eligible processes
- **THEN** the system reports this without showing a confirmation dialog
