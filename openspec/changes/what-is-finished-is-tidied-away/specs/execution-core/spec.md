## ADDED Requirements

### Requirement: The sweep clears an empty leftover and a working directory's shell

A directory under a workspace's changes that holds no file at all SHALL
count as holding only what this product wrote, and SHALL be cleared where
a change of its name is archived.

An empty directory holds nothing anybody worked on. The rule that keeps a
person's fresh directory safe is the archive check, not the file count,
and requiring at least one file refused the very case the sweep exists
for.

The sweep SHALL also read the root the working directories live under, and
SHALL report every directory there that git does not list as a working
directory and that holds no file at any depth. Those SHALL be cleared with
the rest. A directory holding one file at any depth SHALL be reported and
never cleared.

Removing a working directory leaves such a shell behind where a link was
inside it, and git stops listing it, so nothing else in the product can
see what the product itself left.

#### Scenario: An empty directory whose change is archived

- **WHEN** a directory under the changes holds no file and a change of its
  name is in the archive
- **THEN** the sweep clears it

#### Scenario: An empty directory nobody archived

- **WHEN** a directory under the changes holds no file and nothing of its
  name is archived
- **THEN** it is reported and left where it is

#### Scenario: A shell left by removing a working directory

- **WHEN** a directory under the worktree root holds no file and git does
  not list it as a working directory
- **THEN** the sweep reports it and clears it

#### Scenario: A directory with something in it

- **WHEN** such a directory holds a file at any depth
- **THEN** it is reported and never cleared

### Requirement: A directory that cannot be removed says what is holding it

Where removing a directory fails, the refusal SHALL name the processes
whose command line mentions that directory, with each process's identifier
and name, and SHALL say that a process which does not name the directory
is not found this way.

An operating system's "access denied" is not something a person can act
on. The three directories that prompted this were held by servers this
product's own checks had started days earlier, and each named its
directory on its command line.

The reading SHALL be best effort: where the process list cannot be read,
the refusal SHALL carry the original error and no holder, rather than
claiming that nothing holds the directory.

#### Scenario: A directory a process holds

- **WHEN** a removal fails and a process names that directory on its
  command line
- **THEN** the refusal names that process, with its identifier

#### Scenario: The process list cannot be read

- **WHEN** a removal fails and the process list cannot be read
- **THEN** the refusal carries the original error and names no holder

### Requirement: A working directory is finished with when the work has landed

Whether a working directory has nothing left to do SHALL be read from
what settles it: the change's pull request merged, or the default branch
carrying that change archived, beside a branch that is gone from
everywhere or whose tip the default branch already contains.

A repository that squashes its pull requests never makes a branch's tip an
ancestor of its default branch, so a merge base alone answers "not
finished" for work that plainly is.

A directory SHALL be called finished with only where its tree is clean and
no run is recorded against it, and the main working directory SHALL never
be called finished with. Each SHALL carry the reason it is finished with,
so a surface can say why rather than assert it.

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
