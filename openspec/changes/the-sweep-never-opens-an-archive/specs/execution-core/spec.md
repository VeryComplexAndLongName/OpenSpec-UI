## MODIFIED Requirements

### Requirement: The sweep finishes a removal git gave up on

When the workspace sweep removes a working directory whose work has landed,
it SHALL remove whatever is left of the directory after
`git worktree remove`, whether that command succeeded or failed. Where git
failed, the sweep SHALL then have git forget worktrees whose directories
are gone. A removal SHALL be reported as failed only where the directory
could not be removed either way, and then with the reason the removal
itself failed, followed by git's.

`git worktree remove` SHALL run with long paths allowed. Every recursive
removal in `packages/core` SHALL go through Electron's unpatched
`original-fs` where it runs in Electron, so that a `*.asar` file in the
directory is removed as a file and never opened as an archive.

#### Scenario: git gives up on a long path

- **WHEN** `git worktree remove` fails on a finished working directory
- **THEN** the directory is removed anyway, git no longer lists it as a
  worktree, and what a link inside it pointed at is untouched

#### Scenario: A path longer than Windows allows

- **WHEN** a finished working directory holds a path longer than 260
  characters
- **THEN** `git worktree remove` removes it

#### Scenario: A downloaded editor in the editor

- **WHEN** the sweep runs in the editor and the directory holds a
  `node_modules.asar`
- **THEN** the directory is removed, and the editor does not hold the file
  afterwards

#### Scenario: The directory cannot be removed at all

- **WHEN** both git and the shell removal fail
- **THEN** the sweep reports the directory as not removed, with the
  removal's reason first and git's after it
