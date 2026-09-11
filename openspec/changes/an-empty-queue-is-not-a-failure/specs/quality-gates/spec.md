## MODIFIED Requirements

### Requirement: A passing check has checked what its name says

A repository check SHALL fail when the thing it is named for is absent
or wrong, and SHALL NOT pass on an input it did not read.

A lint that reads only one spelling of what it checks passes the other
spellings unread; a test that asserts one value appears passes a chart
drawn entirely wrong; a fixture that borrows the developer's
configuration passes on one machine and fails on another for a reason
unrelated to the code. Each is a green result that reports nothing.

The changeset lint SHALL read every form a package name may take in a
changeset's frontmatter, and SHALL refuse a line it cannot read.

A test named for a shape SHALL assert that shape.

A fixture that runs a tool SHALL isolate that tool from configuration
outside the repository.

A guard against a check reaching nothing SHALL distinguish a subject
that is empty from a reach that is broken, and SHALL fail only for the
second. A repository with no work in flight has reached that state by
finishing its work; a build that goes red for it reports success as a
regression.

#### Scenario: A changeset with an unquoted name

- **WHEN** a changeset names a package without quotes, misspelled
- **THEN** the lint fails, naming the file and the name

#### Scenario: A chart drawn wrong

- **WHEN** the per-day chart draws every bar as zero over a history with
  archives
- **THEN** the browser test named for that history fails

#### Scenario: A developer with commit signing on

- **WHEN** the dated-workspace fixture runs on a machine whose global
  git configuration requires signed commits
- **THEN** the fixture commits, and the test runs

#### Scenario: No work in flight

- **WHEN** every change has been archived and none is active
- **THEN** the checks that read the active changes report nothing to
  read, and the build stays green
