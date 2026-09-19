## ADDED Requirements

### Requirement: A stop can name the task to stop after

A request to stop SHALL be able to name a task of the change, and a run
that receives one SHALL go on working until that task is done, then stop
where the work is sound.

An operator who wants a run to finish part of a change and stop has,
otherwise, only the choice between watching for the moment and undoing
what came after.

The named task SHALL be counted done when its checkbox is ticked in the
change's task list, or when the run's agent says it is starting a task
that comes after it. The run SHALL end there, rather than at the next
sound point after it: a task's tick is itself a sound point, and waiting
for another one lets the agent into the task the operator asked it not to
start. The run SHALL end cancelled, carrying the reason and the asker as
any stop does.

How soon the run learns that the task was ticked SHALL be a bounded wait,
not the interval a pending stop uses: while a request naming a task is
held, the list SHALL be read often enough that the agent is unlikely to
have started the next task, and the documentation SHALL say that the
window exists rather than promising it away.

A request naming a task the change's list does not have SHALL be refused,
said in the run's activity, and recorded; the run SHALL go on. A request
naming a task already ticked SHALL stop the run at the next sound point,
and SHALL say that the point it named had passed.

The run's recorded ending SHALL name the task it was told to stop after,
beside the reason and the asker.

Nothing here SHALL pause a run. A request that is held is held by the
run's own reading of its task list, and the run keeps working until it is
honoured.

#### Scenario: The named task is reached

- **WHEN** a run is asked to stop after a task, and that task is then
  ticked
- **THEN** the run ends there, without waiting for another marker or
  another tick, and no further stage starts

#### Scenario: The agent moves past the named task

- **WHEN** a run is asked to stop after a task, and its agent then says it
  is starting a task that comes after it
- **THEN** the run stops at that moment

#### Scenario: A task the change does not have

- **WHEN** a request names a task that is not in the change's task list
- **THEN** it is refused with that reason, the run says so, and the run
  goes on

#### Scenario: A point already passed

- **WHEN** a request names a task that is already ticked
- **THEN** the run stops at the next sound point and says the point it was
  given had passed

#### Scenario: What the ending says

- **WHEN** a run ends because it was asked to stop after a task
- **THEN** its recorded ending names that task, the reason and the asker
