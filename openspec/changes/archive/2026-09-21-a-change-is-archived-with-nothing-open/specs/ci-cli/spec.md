## ADDED Requirements

### Requirement: The gate checks what a pull request archives

The validation command SHALL accept the ref a pull request merges into,
and SHALL apply the rule that a change lands with nothing open to every
change that pull request archives: every directory under the archive
that is present in the working tree and absent from that ref.

An archive made by any tool SHALL be caught this way, including one
made with a tool this product does not control.

The comparison SHALL read the two listings of the archive and SHALL NOT
need the history between them.

Where the ref cannot be read, the command SHALL say so and SHALL fail: a
check that could not run is not a check that passed.

The changes already archived on that ref SHALL NOT be read.

#### Scenario: A pull request archives a change with an item open

- **WHEN** a pull request adds an archive directory whose task list has
  an unticked item
- **THEN** the gate fails and names the change and the item

#### Scenario: A pull request archives finished changes

- **WHEN** every archive directory the pull request adds is closed
- **THEN** the gate passes

#### Scenario: The base cannot be read

- **WHEN** the ref given cannot be read
- **THEN** the gate says so and fails
