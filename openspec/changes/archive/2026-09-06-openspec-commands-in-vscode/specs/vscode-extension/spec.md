## ADDED Requirements

### Requirement: A repository's own checks can be run from the editor

The extension SHALL be able to run the checks the workspace declares,
reusing the mechanism the harness already uses to run them rather than
introducing a second one.

Which command each check runs SHALL come from the workspace, not from the
extension. The extension SHALL NOT assume that a script of a given name
exists or means what it means here, and SHALL offer nothing for a check
the workspace does not declare, rather than offering a command that
fails.

A workspace SHALL be able to expose a command to the editor that differs
from the one it runs itself, so that a faster subset can be offered
without renaming anything.

A check's result SHALL name the command that ran and what came back, so a
failure is actionable without re-running it in a terminal.

#### Scenario: The workspace declares a check

- **WHEN** a workspace declares the script a check maps to
- **THEN** the check can be run from the editor, and its result names the
  command and its output

#### Scenario: The workspace declares nothing

- **WHEN** a workspace declares no script for a check
- **THEN** the extension offers no command for it

#### Scenario: The workspace offers the editor a different command

- **WHEN** a workspace exposes a command intended for the editor
  alongside its own
- **THEN** the editor runs the one intended for it

#### Scenario: A check fails

- **WHEN** a check run from the editor fails
- **THEN** the failure states which command ran and what it returned
