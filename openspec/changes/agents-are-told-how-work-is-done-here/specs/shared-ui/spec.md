## ADDED Requirements

### Requirement: The standalone writes the rules on initialize and follows a new change

The standalone's init form SHALL offer a checkbox, checked, for adding the
workflow rules to the end of an existing `CLAUDE.md` or `AGENTS.md`, and
SHALL say which files were written. After creating a change in its own
working directory, the page SHALL work in that directory and open the
change; the server SHALL allow the repository's own working directories
as a `cwd`, and nothing else outside the workspace.

#### Scenario: Create a change from the page

- **WHEN** a change is created from the Change Editor in a repository with
  an `origin`
- **THEN** the page's workspace root becomes the change's directory and the
  change is open in the editor