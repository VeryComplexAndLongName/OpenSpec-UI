## MODIFIED Requirements

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
directory. Such a directory SHALL be cleared where it holds no file at any
depth, and SHALL also be cleared, whatever it holds, where it is named
after a change this repository knows - active or archived - and holds no
`.git` of its own. Any other SHALL be reported and never cleared.

Removing a working directory leaves such a shell behind where a link was
inside it, and git stops listing it, so nothing else in the product can
see what the product itself left. Emptiness alone excused the only case
this exists for: what a half-finished removal leaves is exactly the files
that could not be deleted. What is in a directory says nothing about whose
it is; its name and the absence of a checkout of its own do.

Links inside such a directory SHALL be unlinked before it is walked, so a
module overlay's junctions cannot carry the removal into the directory
they point at.

The periodic workspace sweep SHALL do this itself, on the worktree root as
this product resolves it, and SHALL say what it removed and what is still
held. A directory it could not remove SHALL be tried again on a later
pass rather than reported once and forgotten.

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

- **WHEN** such a directory holds a file at any depth, and no change of
  this repository carries its name
- **THEN** it is reported and never cleared

#### Scenario: A shell a locked file was left in

- **WHEN** a directory under the worktree root holds files, git does not
  list it, it is named after a change this repository knows, and it holds
  no `.git` of its own
- **THEN** the sweep clears it

#### Scenario: A checkout of its own

- **WHEN** such a directory holds a `.git`, as a file or as a directory
- **THEN** it is reported and never cleared

#### Scenario: A shell something still holds

- **WHEN** the sweep cannot remove such a directory
- **THEN** it says what stopped it, and the next pass tries again
