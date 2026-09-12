## ADDED Requirements

### Requirement: Every working directory of the repository is surveyed

The tool SHALL report every working directory of the repository it was
opened on, not only the one it was pointed at.

For each, it SHALL report the branch that directory has checked out, the
changes in that directory's own queue, how far each of those changes has
got, and, where a mutating run holds it, who holds it.

A directory that cannot be read SHALL be reported as unreadable, and
SHALL NOT remove the others from the survey.

#### Scenario: A second working directory with changes of its own

- **WHEN** another working directory holds changes that this one does
  not
- **THEN** they are reported, with the branch they are on

#### Scenario: A directory that cannot be read

- **WHEN** one working directory cannot be read
- **THEN** it is reported as unreadable and the rest of the survey still
  appears

### Requirement: Another directory's changes cannot be acted on

A change belonging to another working directory SHALL carry no action:
it SHALL NOT be openable, runnable, or modifiable from here.

A change SHALL be identified by its working directory together with its
name, never by name alone, so that no action can reach a change of the
same name in a different directory.

Recessed or otherwise quietened presentation SHALL NOT be the only thing
that makes it unmodifiable.

#### Scenario: A change belonging to somebody else's directory

- **WHEN** a change from another working directory is shown
- **THEN** nothing offers to open, run, or change it

#### Scenario: One name in two directories

- **WHEN** two working directories each hold a change of the same name
- **THEN** each is shown under its own directory, and neither can be
  acted on through the other

### Requirement: A working directory is labelled, and the label is not an identity

Each working directory SHALL carry a label.

Where the directory declares none, its own directory name SHALL be used,
so that a directory that declares nothing is still named.

The label SHALL be reported as self-declared. Nothing SHALL be permitted
or refused on the strength of it.

#### Scenario: A directory that declares nothing

- **WHEN** a working directory carries no declared label
- **THEN** it is named by its directory name

#### Scenario: A directory that declares a label

- **WHEN** a working directory declares a label
- **THEN** that label names it

### Requirement: A run by a different git author is distinguished

Where a working directory is held by a run whose recorded git author
differs from this checkout's own configured identity, the survey SHALL
say so.

It SHALL be said in words. Colour MAY agree with those words and SHALL
NOT be the only thing that carries the distinction.

The label and the git author SHALL be reported as the separate facts
they are; neither SHALL stand in for the other.

#### Scenario: Another person's run

- **WHEN** a directory's lease records a git author other than this
  checkout's
- **THEN** the survey says so in words

#### Scenario: Several directories, one person

- **WHEN** every directory records the same git author
- **THEN** none is distinguished as another person's, and each is still
  named by its own label

### Requirement: A reading names the branch it came from

The tool SHALL name the branch each reading was taken from.

An empty queue SHALL therefore be distinguishable from a reading taken
somewhere other than where the reader expected.

#### Scenario: A checkout with no active changes

- **WHEN** the directory being read has no active changes
- **THEN** it says so and names the branch it read

### Requirement: Nothing from another directory enters this one's order

Changes belonging to another working directory SHALL be laid out against
that directory's own queue, and SHALL NOT be placed in this one's order.

No relation SHALL be drawn between changes in different working
directories. The repository declares no order between them, and a drawn
relation would assert one.

#### Scenario: Two directories with unrelated changes

- **WHEN** two working directories each hold changes
- **THEN** each set is laid out on its own, and nothing is drawn between
  them

### Requirement: A change present in more than one directory is reported

Where one change exists in more than one working directory, the survey
SHALL report it.

It SHALL NOT be refused, prevented, or resolved: it arises from ordinary
branching, and becomes a conflict only if a copy is edited.

#### Scenario: A change inherited by a new working directory

- **WHEN** a change exists in two working directories at once
- **THEN** the survey reports that it does, and both continue to be
  shown
