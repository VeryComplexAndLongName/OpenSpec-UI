## ADDED Requirements

### Requirement: The implementing stage is told to tick what it finished

The implementing stage's instruction SHALL tell the agent to tick each
task in `tasks.md` as soon as that task's own verification has passed,
never before the task is done, and to leave a task it could not do
unticked and report why.

This SHALL be part of the product's own instruction, and SHALL NOT depend
on a project's configured rules.

#### Scenario: A repository with no rules about tasks

- **WHEN** a chain runs in a repository whose configuration states no
  rules about tasks
- **THEN** the implementing agent is still told to tick each task it
  finished

### Requirement: Verification ticks what it confirms

The verifying stage's instruction SHALL tell the agent to tick an
unticked task whose verification it has confirmed itself, and to untick
a ticked task whose verification does not hold.

It SHALL state that a task whose effect is not a changed file is
confirmed by checking that effect, and that leaving no changed file is
not by itself a reason to leave a task unticked.

It SHALL tell the agent never to tick a task marked `**Human-only**` or
`**Delegated to …**`.

#### Scenario: Work done and not ticked

- **WHEN** the implementing run did a task without ticking it, and the
  verifying agent confirms that task's verification
- **THEN** the verifying agent is permitted to tick it

#### Scenario: A task whose effect is a command

- **WHEN** a task requires a command to pass and changed no file
- **THEN** the verifying agent is told to confirm it by checking that
  effect rather than to leave it unticked for want of a file

#### Scenario: A task for a person or another agent

- **WHEN** a task is marked `**Human-only**` or `**Delegated to …**`
- **THEN** the verifying agent is told not to tick it

### Requirement: An implementing run that ticked nothing is named

When an implementing run completes having changed files, and no task in
`tasks.md` went from unticked to ticked during it, the chain SHALL say so
as that stage ends.

It SHALL NOT fail the stage or stop the chain for it.

#### Scenario: Files changed, nothing ticked

- **WHEN** the implementing stage completes with a non-empty change to
  the working directory and the same number of ticked tasks as before it
- **THEN** the chain reports that the stage changed files and ticked no
  task, and continues to verification

#### Scenario: Nothing changed

- **WHEN** the implementing stage completes having changed no file
- **THEN** no such report is made

### Requirement: A refused archive names the unticked tasks

When the archive step refuses a change because tasks are unticked, the
refusal SHALL name those tasks, not only count them.

#### Scenario: Two tasks left

- **WHEN** a chain reaches archive with two tasks unticked
- **THEN** the refusal names both
