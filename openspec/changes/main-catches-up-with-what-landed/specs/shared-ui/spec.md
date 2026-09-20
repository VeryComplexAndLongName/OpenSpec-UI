## ADDED Requirements

### Requirement: The Pipeline says how far behind this checkout is

The Pipeline SHALL say, above the picture, how many commits this
checkout's default branch is behind its remote and how many of the changes
it draws are archived on that branch, and SHALL offer to catch up.

Where the checkout is level with its remote, it SHALL say nothing: a line
that is always there is a line nobody reads.

A refusal from the catch-up SHALL be shown where the press was made.

A card of a change in another working directory SHALL say that the change
is archived on the default branch where the standings say so.

#### Scenario: A checkout behind its remote

- **WHEN** the default branch is behind its remote
- **THEN** the Pipeline says by how many commits, and how many of the
  changes drawn are archived on that branch

#### Scenario: A checkout level with its remote

- **WHEN** the branch is level
- **THEN** no such line is shown

#### Scenario: Catching up is refused

- **WHEN** the catch-up is pressed and core refuses it
- **THEN** the refusal is shown beside the press, and the picture is
  unchanged

#### Scenario: A change already archived, worked elsewhere

- **WHEN** a change in another working directory is archived on the
  default branch
- **THEN** its card says so
