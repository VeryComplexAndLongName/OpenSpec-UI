## ADDED Requirements

### Requirement: A failed run says what is known about why

When a run of any agent fails, the runner SHALL diagnose the failure from
the run's reason and the last of its output, and SHALL attach the
diagnosis to the `failed` event and to the run's terminal audit entry.

A diagnosis SHALL name one cause from a closed set: the agent is not
installed, it is not signed in, the machine blocked it, the network could
not be reached, the service rate-limited it, the service failed, or
unknown. It SHALL say whether repeating the run can help (`no`, `likely`
or `unknown`), SHALL quote the line the cause was found in, and SHALL say
what to do instead where repeating cannot help.

A failure matching no known cause SHALL be diagnosed as `unknown`, never
as a guessed cause.

The diagnosis SHALL be an optional field. A reader written before it
SHALL read the event and the entry as before.

#### Scenario: An agent that is not signed in

- **WHEN** a run fails and its output says "Authentication required"
- **THEN** its `failed` event and its audit entry carry the cause
  "not signed in", repeating `no`, the quoted line, and a remedy naming
  the agent's executable

#### Scenario: An agent that is not installed

- **WHEN** a run fails because its executable could not be found
- **THEN** the diagnosis says the agent is not installed and that
  repeating will not help

#### Scenario: A service under load

- **WHEN** a run fails and its output names HTTP 503
- **THEN** the diagnosis says the service failed and that repeating is
  likely to help

#### Scenario: A failure nobody has seen

- **WHEN** a run fails with output matching no known cause
- **THEN** the diagnosis says the cause is unknown and whether repeating
  helps is unknown

#### Scenario: A chain fails at a stage

- **WHEN** a chain ends because one of its stages failed
- **THEN** the chain's ending entry carries that stage's diagnosis
