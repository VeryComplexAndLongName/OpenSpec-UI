## ADDED Requirements

### Requirement: The core says where a change is worked and by whom

`packages/core` SHALL answer, for one active change and one survey of the
repository's working directories, which of four things is true of it:

- it is worked in the directory the reading was taken from;
- it is worked in another working directory, which SHALL be named by its
  label and path, with its branch where it has one, and with the enrolled
  person where a verified status record names one;
- it is worked in another working directory whose status record does not
  check out, which SHALL be named without naming any person;
- no working directory has taken it up.

A working directory SHALL be read as working a change both where the
survey pairs the two and where the directory's branch bears that change's
name and the change is present in that directory. The pairing alone holds
only while the change is active on the default branch, which a change
proposed this morning is not.

The sentence each answer is shown as SHALL come from `packages/core` too,
so that two surfaces cannot word the same answer differently. The two
answers about another working directory SHALL have a sentence; this
directory's own change and a change nobody has taken up SHALL have none,
so that a repository worked in one directory does not caption every row
with the same words.

Where no survey could be taken, every change SHALL read as taken up by
nobody, and the reading SHALL NOT fail.

#### Scenario: Another directory is the change's worktree

- **WHEN** a working directory's branch bears an active change's name, and
  a verified record reports an agent working there
- **THEN** the reading says the change is worked in that directory, and
  names the directory and the person

#### Scenario: A record that does not check out

- **WHEN** the only record reporting from that directory fails its
  signature
- **THEN** the reading names the directory, names no person, and says the
  signature did not check out

#### Scenario: A change proposed after the directory was cut

- **WHEN** a working directory's branch bears the name of a change that is
  present there and is not yet on the default branch
- **THEN** the reading says that directory is working it

#### Scenario: A change nobody has taken up

- **WHEN** an active change is in this checkout and no working directory
  is its worktree
- **THEN** the reading says nobody has taken it up
