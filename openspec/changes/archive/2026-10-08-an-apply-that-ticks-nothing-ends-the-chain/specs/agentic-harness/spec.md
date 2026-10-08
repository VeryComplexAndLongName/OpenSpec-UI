## MODIFIED Requirements

### Requirement: An implementing run that ticked nothing is named

When an implementing run completes having changed files, and no task in
`tasks.md` went from unticked to ticked during it, the chain SHALL say so
as that stage ends.

It SHALL NOT fail the stage or stop the chain for it.

When an implementing run completes having changed no file, and no task went
from unticked to ticked during it, while a task is still open that is
neither marked **Human-only** nor delegated to another agent, the chain
SHALL end as failed before any later stage runs, saying that the stage
changed no file and ticked no task and naming the open tasks. Where the
change to the working directory or the task list could not be read, the
chain SHALL go on as it would otherwise.

#### Scenario: Files changed, nothing ticked

- **WHEN** the implementing stage completes with a non-empty change to
  the working directory and the same number of ticked tasks as before it
- **THEN** the chain reports that the stage changed files and ticked no
  task, and continues to verification

#### Scenario: Nothing changed

- **WHEN** the implementing stage completes having changed no file
- **THEN** no report that it changed files and ticked no task is made

#### Scenario: Nothing changed, nothing ticked, work open

- **WHEN** the implementing stage completes having changed no file, with
  the same number of ticked tasks as before it, and a task open that is
  neither Human-only nor delegated
- **THEN** the chain ends as failed, naming that task, and neither
  verification nor archive runs

#### Scenario: Nothing changed, only a person's work open

- **WHEN** the implementing stage completes having changed no file, and
  every open task is Human-only or delegated
- **THEN** no such failure is made, and the chain goes on
