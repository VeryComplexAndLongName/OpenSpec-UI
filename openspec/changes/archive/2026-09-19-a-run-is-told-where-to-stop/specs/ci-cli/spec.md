## ADDED Requirements

### Requirement: A stop from the terminal can name the task to stop after

`stop` SHALL take the task to stop after, and SHALL carry it in the signed
request so the run finishes that task before stopping.

A value that is not a task number SHALL be refused before anything is
written, naming what was given, and SHALL exit as the CLI's own refusal
rather than as a change that failed.

What was asked SHALL be printed, so the operator can see the task their
request carries and not only that a request went.

#### Scenario: Stopping after a task

- **WHEN** `stop` names a live run, a reason and a task to stop after
- **THEN** a signed request carrying that task is written, and what was
  asked is printed

#### Scenario: Something that is not a task number

- **WHEN** the task given is not a task number
- **THEN** nothing is written, the command says what it was given, and it
  exits with the code the CLI uses for a check it could not run
