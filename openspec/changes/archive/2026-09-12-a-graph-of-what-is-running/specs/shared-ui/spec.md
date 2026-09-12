## ADDED Requirements

### Requirement: The shell shows the order of the work as a picture

The shell SHALL provide a view that lays out every active change as a
node, positioned by its place in the declared `blocked_by` order, with
changes that block nothing and are blocked by nothing shown side by
side.

The view SHALL draw a relation only where the repository states one. A
declared blocker SHALL be drawn as a relation from the blocker to the
change it blocks.

The view SHALL be built only from facts already derived for the
readiness report, so that it and the terminal's report of the same
question cannot disagree.

#### Scenario: Changes in a declared order

- **WHEN** a change declares that it is blocked by another
- **THEN** it is placed after that change, and the relation is drawn

#### Scenario: Changes with no relation between them

- **WHEN** two changes declare nothing about each other
- **THEN** they are placed side by side, and nothing is drawn between
  them

#### Scenario: A cycle of declared blockers

- **WHEN** the declared blockers form a cycle
- **THEN** the changes in it are named as a cycle rather than placed,
  because a cycle has no place in an order

### Requirement: A node says what state its change is in, and who is running it

Each node SHALL state whether its change is running, ready to start, or
blocked.

A running change SHALL name where it is running and, where the lease
recorded one, the git author of the run — as attribution, described as
a git author and never as an established identity.

A blocked change SHALL name what it is waiting on. A change that is
ready SHALL name what it can be started alongside.

#### Scenario: A change being implemented

- **WHEN** a run holds a change's working directory and its lease
  recorded a git author
- **THEN** the node says the change is running and names that author

#### Scenario: A run whose lease recorded no author

- **WHEN** a run holds a change's working directory and no git identity
  was recorded
- **THEN** the node says the change is running, and claims nothing about
  who is running it

### Requirement: A collision is shown on the change it affects, not as a relation

Where two changes cannot be started together, the view SHALL show that
on the changes affected, naming the other change and the reason.

It SHALL NOT draw a collision as a relation between them. A collision is
not an order, and a drawn relation would assert one that the repository
does not contain.

#### Scenario: Two ready changes that would collide

- **WHEN** two changes are both ready and would collide
- **THEN** each says it cannot be started alongside the other, and why,
  and nothing is drawn between them

### Requirement: The picture says how current it is

The view SHALL re-read while it is being looked at, and SHALL NOT
re-read while it is not.

It SHALL show when it last read, so that a picture is never presented as
more current than it is.

#### Scenario: The view is not being looked at

- **WHEN** another view is active
- **THEN** the picture is not re-read

#### Scenario: A change starts running while the view is open

- **WHEN** a run takes a change's working directory while the view is
  active
- **THEN** the next read shows that change as running
