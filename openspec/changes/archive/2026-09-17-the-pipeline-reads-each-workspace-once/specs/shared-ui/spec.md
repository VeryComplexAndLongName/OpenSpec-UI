## MODIFIED Requirements

### Requirement: Every working directory of the repository is surveyed

The tool SHALL report every working directory of the repository it was
opened on, not only the one it was pointed at.

For each, it SHALL report the branch that directory has checked out, the
changes in that directory's own queue, how far each of those changes has
got, and, where a mutating run holds it, who holds it.

A directory that cannot be read SHALL be reported as unreadable, and
SHALL NOT remove the others from the survey.

A survey SHALL read each working directory's active changes once, however
many task lists they hold, and SHALL NOT read the directory's archived
changes.

#### Scenario: A second working directory with changes of its own

- **WHEN** another working directory holds changes that this one does
  not
- **THEN** they are reported, with the branch they are on

#### Scenario: A directory that cannot be read

- **WHEN** one working directory cannot be read
- **THEN** it is reported as unreadable and the rest of the survey still
  appears

#### Scenario: A repository with hundreds of archived changes

- **WHEN** a survey is taken of three working directories, each with
  several active changes and hundreds of archived ones
- **THEN** each directory's active changes are read once, no archived
  change is read, and every change's task counts are reported as before
