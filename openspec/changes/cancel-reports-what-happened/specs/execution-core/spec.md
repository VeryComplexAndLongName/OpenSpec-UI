## ADDED Requirements

### Requirement: Cancellation is reported when it happens, not when it is asked for

The system SHALL report a run as cancelled only once the process running
it has ended.

Between the request and that moment the system SHALL report a distinct
state meaning cancellation is in flight. That state SHALL NOT be
terminal: a run in it is still running, and everything that follows from
a run being active SHALL continue to follow.

Where the process does not end, the system SHALL report a failure saying
what was attempted, and SHALL NOT report the run as cancelled.

Where a cancellation names a run the system is not running, it SHALL say
that, and SHALL NOT report a cancellation that did not occur.

#### Scenario: A process that stops

- **WHEN** a run is cancelled and its process ends
- **THEN** the system first reports cancellation in flight, then reports
  the run cancelled

#### Scenario: A process that does not stop

- **WHEN** a run is cancelled and its process does not end
- **THEN** the system reports a failure naming what was attempted, and
  never reports the run as cancelled

#### Scenario: A run that is not running

- **WHEN** a cancellation names a run the system is not running
- **THEN** the system reports that there was nothing to cancel

#### Scenario: A run nobody cancelled

- **WHEN** a run is never cancelled
- **THEN** the events it produces are exactly what they were before this
  requirement

### Requirement: A cancellation reaches the run it names

A cancellation SHALL be delivered to whatever is running the run it
names, whichever agent that run was started against.

Where the request does not carry enough information to identify that,
the system SHALL determine it from the run rather than fall back to a
default. A default is a guess, and a cancellation delivered to the wrong
place reports that there was nothing to cancel while the run continues.

A cancellation SHALL NOT itself be recorded as a unit of work. It is a
signal about a run, not a run.

#### Scenario: Cancelling a run on a non-default agent

- **WHEN** a run started against an agent other than the default is
  cancelled
- **THEN** the cancellation reaches that run, and the run stops

#### Scenario: A cancellation carrying no agent

- **WHEN** a cancellation names a run but not the agent running it
- **THEN** the system resolves the agent from the run itself

#### Scenario: What a cancellation leaves behind

- **WHEN** a cancellation is issued
- **THEN** no new unit of work appears in the list of processes for it

### Requirement: A cancellation that has not taken effect can be repeated

While a run continues to produce output after a cancellation was
requested, the means of cancelling it SHALL remain available, and SHALL
accept a further request.

A report that cancellation is in flight SHALL NOT cause a surface to
present the run as finished, or to withdraw the control that cancels it.

#### Scenario: Cancelling a run that keeps working

- **WHEN** cancellation has been requested and the run is still producing
  output
- **THEN** the control that cancels it is still offered, and pressing it
  again is accepted

#### Scenario: Cancelling a run that stops

- **WHEN** cancellation has been requested and the run has ended
- **THEN** the control is withdrawn, as it is for any finished run

#### Scenario: What the surface says while waiting

- **WHEN** cancellation is in flight
- **THEN** the run is not described as cancelled
