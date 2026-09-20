## MODIFIED Requirements

### Requirement: A working directory is finished with when the work has landed

Whether a working directory has nothing left to do SHALL be read from git
first: its branch has an upstream, and that upstream is gone. A branch
that was pushed and whose remote branch has since been deleted is what a
merged pull request leaves behind in a repository that deletes its
branches on merge, and it is an answer git gives offline.

The reading SHALL fetch with pruning before it reads, since a deleted
remote branch becomes visible as gone only then. Where the fetch fails,
no directory SHALL be called finished with, and the failure SHALL be the
reason given: a stale reading that removes something is worse than no
reading.

Two further answers SHALL settle it where they are available: the
change's pull request merged, or the default branch carrying that change
archived.

A repository that squashes its pull requests never makes a branch's tip an
ancestor of its default branch, so a merge base alone answers "not
finished" for work that plainly is.

A directory SHALL be called finished with only where its tree is clean and
no run is recorded against it, and the main working directory SHALL never
be called finished with. A branch with no upstream SHALL never be called
finished with, however its change stands: nothing of it was ever pushed.
Each SHALL carry the reason it is finished with, so a surface can say why
rather than assert it, and each directory that is kept SHALL carry the one
reason that kept it.

#### Scenario: A squashed pull request

- **WHEN** a directory's change has a merged pull request, its tree is
  clean and no run is recorded against it
- **THEN** it is finished with, and the reason says the pull request

#### Scenario: Archived on the default branch

- **WHEN** the default branch carries that change archived
- **THEN** the directory is finished with, and the reason says so

#### Scenario: Work still in the tree

- **WHEN** a directory's change has landed but its tree is not clean
- **THEN** it is not finished with

#### Scenario: The branch the server no longer has

- **WHEN** a directory's branch has an upstream that git reports gone,
  its tree is clean and no run is recorded against it
- **THEN** it is finished with, whatever the change stands at and whether
  or not pull requests could be read

#### Scenario: A branch that was never pushed

- **WHEN** a directory's branch has no upstream
- **THEN** it is not finished with, and the reason says the branch was
  never pushed

#### Scenario: A fetch that failed

- **WHEN** the pruning fetch fails
- **THEN** no directory is finished with, and the failure is the reason

## ADDED Requirements

### Requirement: A working directory that is done is removed

The sweep SHALL remove a working directory it reads as finished with,
rather than offering the removal, and SHALL say what it removed and why.

Removing one SHALL remove the worktree and whatever shell is left behind
where a link was inside it. A link SHALL be unlinked and never followed:
a working directory may hold a link to a directory shared with the rest
of the repository, and following one would delete what it points at.

The local branch SHALL be left alone. It costs nothing and it holds the
commits, which matters where a remote branch was deleted without merging
- something git cannot distinguish from a merge.

Nothing under `openspec/changes/` SHALL be read, moved or written while
removing a working directory. A change is repository content, and
archiving one is a separate act with its own commit.

#### Scenario: A directory whose branch is gone

- **WHEN** the sweep finds a working directory that is finished with
- **THEN** it removes the worktree and its shell, leaves the branch, and
  reports what it removed and why

#### Scenario: A directory holding a link

- **WHEN** the directory holds a link to a directory outside it
- **THEN** the link is unlinked and what it pointed at is untouched

#### Scenario: The changes are not touched

- **WHEN** any working directory is removed
- **THEN** no file under `openspec/changes/` has changed
