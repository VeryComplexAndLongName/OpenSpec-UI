## ADDED Requirements

### Requirement: A run can be bounded in time

The harness SHALL support an optional time ceiling on a whole chain and
on a single stage, configurable globally and per change. An absent
ceiling SHALL mean unbounded, matching every configuration written before
the field existed.

Unlike a spending ceiling, a time ceiling SHALL be able to stop a stage
that is already running. Elapsed time is known while a run is in
progress, where a run's cost is not, and a ceiling that could only stop
the next stage could not stop the stage that has stopped making progress.

Elapsed time SHALL accumulate while a stage is running and SHALL NOT
accumulate while the chain waits for a person at a checkpoint. A person
deliberating is not a run consuming anything, and a ceiling that counted
it would fire on chains behaving exactly as configured.

Where a stage is cut, the work it has already done SHALL be left in
place. A stage cut near the end of its work has produced something a
further attempt can continue from, and the checkpoint taken before the
stage remains available to anyone who wants it undone.

#### Scenario: A stage exceeds its ceiling

- **WHEN** a stage runs longer than the configured stage ceiling
- **THEN** that stage is stopped, and the underlying agent process is
  terminated

#### Scenario: A chain exceeds its ceiling

- **WHEN** the time its stages have spent reaches the configured chain
  ceiling
- **THEN** the chain stops rather than starting further work

#### Scenario: The chain is waiting for a person

- **WHEN** the chain is paused at a checkpoint awaiting confirmation
- **THEN** that time does not count toward either ceiling

#### Scenario: No ceiling is configured

- **WHEN** no time ceiling is set
- **THEN** the run is bounded by nothing, as before

### Requirement: A run stopped by a rule says so

Where the harness stops a run because a configured ceiling was reached,
the run SHALL be reported as cancelled rather than failed, and the report
SHALL state which ceiling was reached and what it was set to.

Stopped by a rule is not the same as broken. Reporting a working ceiling
as a failure teaches a reader to discount failures, and a reader seeing a
cancellation needs to know whether a person asked for it or a rule fired.

Where a run is cancelled by a person, no reason SHALL be required — that
is what a cancellation has always meant.

#### Scenario: A ceiling stops a run

- **WHEN** a run is stopped because it reached a time ceiling
- **THEN** it is reported as cancelled, naming the ceiling and its value

#### Scenario: A person stops a run

- **WHEN** a person cancels a run
- **THEN** it is reported as cancelled, and no reason is required

### Requirement: A stage may be attempted a stated number of times

The harness SHALL support a stated maximum number of attempts for a
single stage, and SHALL record why each attempt after the first happened.

There SHALL be one such number, covering every reason a stage is
attempted again. Separate ceilings per reason multiply: three attempts
for one reason and three for another produce nine runs of a stage that
nobody configured.

Where the attempts are exhausted, the chain SHALL stop and name the
stage and the reasons its attempts ended, rather than continuing to a
stage whose prerequisites were not met.

#### Scenario: A cut stage is attempted again

- **WHEN** a stage was stopped by a ceiling and attempts remain
- **THEN** it may be attempted again, and the attempt records the reason
  the previous one ended

#### Scenario: The attempts are exhausted

- **WHEN** a stage has used every attempt it is allowed
- **THEN** the chain stops, naming the stage and why its attempts ended

### Requirement: What a run has spent against its ceilings is visible while it runs

Where a ceiling is configured, the surface that shows a running chain
SHALL show what has been spent against it beside what has been spent in
money and tokens, and SHALL show the attempt a stage is on where more
than one has been made.

A ceiling nobody can see approaching is indistinguishable from no ceiling
until it fires.

#### Scenario: A time ceiling is configured

- **WHEN** a chain runs with a time ceiling configured
- **THEN** the elapsed time and the ceiling are both shown

#### Scenario: A stage is on a later attempt

- **WHEN** a stage is running for the second or later time
- **THEN** the surface shows which attempt it is on, and why the previous
  one ended
