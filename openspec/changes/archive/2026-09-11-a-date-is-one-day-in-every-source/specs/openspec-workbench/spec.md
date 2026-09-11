## MODIFIED Requirements

### Requirement: A change is dated by evidence, and each date says where it came from

A change SHALL carry the dates it can be dated by — when it was
proposed, when it was first worked on, when it was last worked on, and
when it was archived — and each SHALL carry the source it was read from.

A date read from a commit and a date read from a directory name are
different claims. Presented alike they plot alike, and the one that
survives someone renaming a directory is not the one that looks the
same.

The day a date falls on SHALL be the day where the action happened, as
its record states it, whichever source it was read from. A commit made
at half past two in the morning in one timezone is that day to the
person who made it and to the directory the archive named; a reading
that moves it to the previous day for one source and not the other
makes the two sources disagree about one action.

Evidence that work happened SHALL be a task that was finished or a run
that was recorded, never a line that was merely written. A change's task
list is created by the same commit that proposes it, so dating work by
when its lines were written reports the proposal date under another
name — measured across 185 changes, that field was exactly zero days
after the proposal for every one of them. A run that was recorded SHALL
be evidence in every host, not only where a test can supply it.

A date that cannot be determined SHALL be reported as absent, with its
source saying so. A missing date filled in with today's is the kind of
figure that is believed because it looks computed. A date that cannot be
read SHALL be absent too, with its source saying it was unreadable, and
SHALL NOT fail the reading of any other change.

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

#### Scenario: A change archived early in the morning

- **WHEN** the commit that archived a change was made after midnight in
  the committer's timezone
- **THEN** its archived day is that day, the same day its directory
  names

#### Scenario: A change archived by moving the directory

- **WHEN** the directory carries no dated prefix and no commit moved it
- **THEN** the archived date is reported as absent rather than guessed

#### Scenario: A directory name that is not a date

- **WHEN** an archived directory carries a prefix shaped like a date
  that is not one, and no commit dates it
- **THEN** its archived date is absent and says it was unreadable, and
  every other change is still dated

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
  checked, and the timeline is read through a host
- **THEN** the work started when the run did, and says it came from the
  audit log

#### Scenario: A change nobody has committed

- **WHEN** a change exists only in the working tree
- **THEN** its proposed date is absent, and its source says there is
  nothing to read it from

### Requirement: What a project finished is readable as a chart

What a project finished and how long its changes took SHALL be readable
as a chart, in every host that shows the timeline.

Reading the shape of a project's work by opening its change directories
does not scale past the first few dozen; this repository carries 185.

Every chart SHALL state what it rests on: how many changes it drew, how
many were left out for having no date, and how many of its dates came
from a commit rather than from a naming convention. A chart that drops
the source plots an inference and a measurement identically, which is
the confusion the dates were built to remove.

A chart SHALL NOT be shown for a figure measured to be flat. A chart of
a quantity that is nearly always zero reads as a finding rather than as
an absence, and the absence is the finding. The sentence saying so SHALL
be computed from the changes shown, not stated as a fact about one
repository to every user.

Every chart's values SHALL also be readable as text, so what it shows
can be read by a screen reader and copied.

What a chart computes SHALL live in core, so a host that shows the same
figure in another form — a report, a tree — draws it from the same
function. A bucket SHALL be named by its boundaries.

#### Scenario: Reading what was finished

- **WHEN** the timeline is shown for a set of changes
- **THEN** a chart shows how many were archived per day, with how many
  changes it rests on and where their dates came from

#### Scenario: A change with no date

- **WHEN** a change carries no archived date
- **THEN** it is excluded from the chart and counted as excluded, rather
  than plotted at a guessed date

#### Scenario: Reading a chart as text

- **WHEN** a chart is shown
- **THEN** the same values are present as text

#### Scenario: The chart that is not drawn

- **WHEN** the timeline is shown for a workspace
- **THEN** the sentence explaining the absent work-duration chart gives
  that workspace's own count of changes and how many were flat
