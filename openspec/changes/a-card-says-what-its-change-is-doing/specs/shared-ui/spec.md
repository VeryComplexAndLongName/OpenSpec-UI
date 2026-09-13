## ADDED Requirements

### Requirement: What a card says is derived in one place

A card's state, and every line a card states about its change, SHALL be
derived by one function in the core package, from the readings the host
already takes.

A host SHALL render what that function returns, and SHALL NOT derive any
part of it itself.

#### Scenario: Two hosts, one change

- **WHEN** both hosts show the Pipeline for the same workspace at the same
  moment
- **THEN** each change's card states the same words in both

### Requirement: A card states its change's state as one word from a closed set

A card SHALL state its change's state as exactly one of: Running, Waiting,
Failed at a stage, Stopped at a stage, Blocked, Ready, Done.

What is happening now SHALL outrank how the last run ended, and how the last
run ended SHALL outrank what could happen next.

A run's ending SHALL decide the state only while the change's task list is
unchanged since that run ended.

A stop asked for by a person SHALL be stated as Stopped, and never as
Failed. A stop by a configured limit SHALL be stated as Stopped, naming the
limit.

A waiting run SHALL be stated as Waiting, with what it waits for and in
which working directory.

#### Scenario: A run under way

- **WHEN** a run is under way for the change and is not waiting
- **THEN** the card says Running, with the run's stage and activity and how
  long ago the run said so

#### Scenario: A run waiting at a checkpoint

- **WHEN** the change's run is waiting to continue to its next stage
- **THEN** the card says Waiting, names the next stage, and names the
  working directory the run is in

#### Scenario: A failure with nothing since

- **WHEN** the change's latest run failed at apply, nothing is running, and
  the task list has not changed since
- **THEN** the card says Failed at apply

#### Scenario: A failure older than the task list

- **WHEN** the change's latest run failed, and its task list changed after
  that run ended
- **THEN** the card does not say Failed, and still states how the last run
  ended

#### Scenario: A person stopped the run

- **WHEN** the change's latest run was cancelled at verify with no rule
  given as the reason
- **THEN** the card says Stopped at verify

#### Scenario: Every task ticked

- **WHEN** every task of the change is ticked, and nothing is running
- **THEN** the card says Done

### Requirement: A card names the task in hand, or says it is guessing

Where a run's record names a task that the change's list has, the card
SHALL name that task, and SHALL say whether the run said so or was given
the task.

Where a run is under way and names no task, the card SHALL name the first
open task that an agent may do, and SHALL say that this is a guess.

A task that only a person, or only another agent, may close SHALL NOT be
offered as the guess.

#### Scenario: The run said which task

- **WHEN** a run's record says the run is on task 2.3 by its own account
- **THEN** the card names task 2.3, with its text, and says the run said so

#### Scenario: The run said nothing about its task

- **WHEN** a run is under way and its record names no task, and the first
  open task is 2.4
- **THEN** the card names task 2.4 and says that this is probably the task
  in hand

#### Scenario: The first open task is a person's

- **WHEN** the first open task is marked as one only a person can close,
  and the next open task is 2.5
- **THEN** the guess names task 2.5

### Requirement: A card states progress, the last run, and where its facts came from

A card SHALL state how many of its change's tasks are done, out of how many,
and how many open items only a person, or only another agent, can close.

A card SHALL state how the change's latest run ended, at which stage, and
how long ago. It SHALL state what the run cost where a cost was reported,
and SHALL NOT state a cost that was not reported.

A card SHALL name the working directory and the branch its facts were read
from.

#### Scenario: A run whose agent reported no cost

- **WHEN** the change's latest run recorded no usage
- **THEN** the card states how the run ended, and states no cost

#### Scenario: A change with its own worktree

- **WHEN** a change has a worktree of its own
- **THEN** its card states the task progress read from that worktree, and
  names that worktree and its branch
