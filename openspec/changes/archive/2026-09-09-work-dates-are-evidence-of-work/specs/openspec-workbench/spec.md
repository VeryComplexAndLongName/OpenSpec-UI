## MODIFIED Requirements

### Requirement: A change is dated by evidence, and each date says where it came from

A change SHALL carry the dates it can be dated by — when it was
proposed, when it was first worked on, when it was last worked on, and
when it was archived — and each SHALL carry the source it was read from.

A date read from a commit and a date read from a directory name are
different claims. Presented alike they plot alike, and the one that
survives someone renaming a directory is not the one that looks the
same.

Evidence that work happened SHALL be a task that was finished or a run
that was recorded, never a line that was merely written. A change's task
list is created by the same commit that proposes it, so dating work by
when its lines were written reports the proposal date under another
name — measured across 185 changes, that field was exactly zero days
after the proposal for every one of them.

A date that cannot be determined SHALL be reported as absent, with its
source saying so. A missing date filled in with today's is the kind of
figure that is believed because it looks computed.

Dates SHALL be read from the repository's own record — the commits that
added the files, the times its task lines were checked, the runs
recorded against it — before any convention about how a file or
directory is named. A convention is not followed by someone who has not
read it, and a change created by such a person is the case this exists
for.

A date SHALL NOT be read from a field a person writes by hand. Nothing
checks it against what the repository records, so it is the one that
goes wrong.

#### Scenario: A change archived by the archive command

- **WHEN** a change's dates are read after `openspec archive` moved it
- **THEN** the archived date comes from the commit that moved it, and
  says so

#### Scenario: A change archived by moving the directory

- **WHEN** the directory carries no dated prefix and no commit moved it
- **THEN** the archived date is reported as absent rather than guessed

#### Scenario: When the work happened

- **WHEN** a change's tasks were checked over several days
- **THEN** the first and last of those are carried, distinct from when
  the change was proposed and when it was archived

#### Scenario: A task list written but never worked

- **WHEN** a change's task list exists and nothing in it is checked, and
  no run is recorded against it
- **THEN** no work dates are carried, rather than the date the file was
  written

#### Scenario: A run before the first checked task

- **WHEN** a run is recorded against a change before any of its tasks is
  checked
- **THEN** the work started when the run did, and says it came from the
  audit log

#### Scenario: A change nobody has committed

- **WHEN** a change exists only in the working tree
- **THEN** its proposed date is absent, and its source says there is
  nothing to read it from
