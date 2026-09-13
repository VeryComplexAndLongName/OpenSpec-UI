## ADDED Requirements

### Requirement: The implementing stage is told to say which task it starts

The implementing stage's instruction SHALL tell the agent to print, before
it starts work on a task, a line of its own that names the task's number,
in the form a run's status record recognises. The instruction SHALL give
an example of that line.

This SHALL be part of the product's own instruction, and SHALL NOT depend
on a project's configured rules.

The instructions of the other stages SHALL NOT ask for such a line.

#### Scenario: An implementing run

- **WHEN** an implementing run starts, in a repository whose configuration
  states no rules about tasks
- **THEN** the agent is still told to print the line before each task,
  with an example

#### Scenario: A review

- **WHEN** a review or a verification runs
- **THEN** its instruction does not ask for the line
