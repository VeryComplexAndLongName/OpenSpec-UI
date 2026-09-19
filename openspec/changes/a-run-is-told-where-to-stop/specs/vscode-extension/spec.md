## ADDED Requirements

### Requirement: A run can be asked from a change's row to stop after a task

The extension SHALL offer, on a change whose run is live, a command that
asks that run to stop after a named task, taking the task and the reason
from the person and writing the signed request through the shared core.

The command SHALL be offered where the change is acted on, so an operator
who can see a change running can steer it without leaving the view.

On a change with no live run the command SHALL say there is nothing
running to ask, and SHALL write nothing.

A cancelled prompt SHALL write nothing: an escaped keystroke is not a
request.

#### Scenario: Asking a live run

- **WHEN** the command is run on a change whose run is live, and a task
  and a reason are given
- **THEN** a signed request carrying that task is written, and the person
  is told what was asked

#### Scenario: A change with nothing running

- **WHEN** the command is run on a change with no live run
- **THEN** it says there is nothing running to ask, and writes nothing

#### Scenario: The prompt is escaped

- **WHEN** the person escapes the task or the reason
- **THEN** nothing is written
