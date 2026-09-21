## ADDED Requirements

### Requirement: The sweep finishes a removal git gave up on

When the workspace sweep removes a working directory whose work has landed,
it SHALL remove whatever is left of the directory after
`git worktree remove`, whether that command succeeded or failed. Where git
failed, the sweep SHALL then have git forget worktrees whose directories
are gone. A removal SHALL be reported as failed only where the directory
could not be removed either way, and then with git's reason.

#### Scenario: git gives up on a long path

- **WHEN** `git worktree remove` fails on a finished working directory
- **THEN** the directory is removed anyway, git no longer lists it as a
  worktree, and what a link inside it pointed at is untouched

#### Scenario: The directory cannot be removed at all

- **WHEN** both git and the shell removal fail
- **THEN** the sweep reports the directory as not removed, with git's
  reason

### Requirement: The archive pass pushes only an archive

The pass that archives landed changes SHALL push its branch only where its
commit committed something. Where archiving changed nothing, the pass
SHALL fail with that reason, push nothing and open nothing.

#### Scenario: Archiving changes nothing

- **WHEN** the archive step for every due change leaves the tree as it was
- **THEN** no `archive-landed-` branch reaches the server and no pull
  request is opened
