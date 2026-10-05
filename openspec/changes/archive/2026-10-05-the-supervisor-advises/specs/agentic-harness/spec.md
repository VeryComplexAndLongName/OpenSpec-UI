## ADDED Requirements

### Requirement: The supervisor advises by default and can be turned off

The harness configuration SHALL accept `supervisor.mode` with the values
`advise` and `off`, in the global file and in a change's own file. Absent
SHALL mean `advise`. A change's own `supervisor` object SHALL be merged
key by key over the global one.

Under `off`, none of the supervisor's suggestions SHALL be computed.
Under `advise`, the supervisor SHALL suggest and SHALL NOT stop, start,
restart or change any run, file or setting.

Any other value of `supervisor.mode` SHALL be refused where the
configuration resolves.

`supervisor.silentAfterSeconds` and `supervisor.waitingAfterSeconds` SHALL
be positive integers, 600 and 60 where absent.

#### Scenario: A configuration that says nothing about it

- **WHEN** neither harness file sets `supervisor`
- **THEN** the supervisor advises, with thresholds of 600 and 60 seconds

#### Scenario: Turned off

- **WHEN** the resolved `supervisor.mode` is `off`
- **THEN** no suggestion of the supervisor's is computed, and every other
  suggestion still is

#### Scenario: A mode that does not exist

- **WHEN** a harness file sets `supervisor.mode` to a value other than
  `advise` or `off`
- **THEN** resolving the configuration fails and names the field

### Requirement: A run that says nothing new is pointed out

The supervisor SHALL suggest looking at a run whose status record is not
gone, which is not waiting on anyone, and whose activity has not changed
for longer than `supervisor.silentAfterSeconds`.

The suggestion SHALL quote what the run last said and for how long, and
SHALL give the command that shows the run's status and the command that
asks it to stop. It SHALL NOT call the run hung or stuck: a long turn and
a hang look the same from outside (ADR 0028).

#### Scenario: Silent past the threshold

- **WHEN** a run's heartbeat is fresh and its activity is twelve minutes
  old, with the threshold at ten
- **THEN** a suggestion names the run, quotes its last activity, says
  twelve minutes, and gives `status` and `stop` commands for it

#### Scenario: A run whose writer is gone

- **WHEN** a run's heartbeat is older than the staleness window
- **THEN** this suggestion is not made for it

### Requirement: A run waiting on a person is pointed out

The supervisor SHALL suggest attending to a run that has waited on a
checkpoint or a permission for longer than
`supervisor.waitingAfterSeconds`, naming what it waits for.

A waiting run SHALL NOT also be pointed out as saying nothing new.

#### Scenario: A permission nobody answered

- **WHEN** a run has waited for a permission for three minutes, with the
  threshold at one
- **THEN** a suggestion says the run waits on a person, names the
  permission, and the run is not pointed out as silent

### Requirement: A change whose last run cannot be repeated is pointed out

The supervisor SHALL suggest the remedy for a change whose last run
failed with a diagnosis saying repeating will not help, while no run is
working on that change.

#### Scenario: The agent was not signed in

- **WHEN** a change's last run failed diagnosed as "not signed in"
- **THEN** a suggestion says so, quotes the line, and gives the remedy

#### Scenario: A later run succeeded

- **WHEN** a later run of the same change completed
- **THEN** the suggestion is no longer made
