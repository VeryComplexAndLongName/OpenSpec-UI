## ADDED Requirements

### Requirement: A change can be told which named configuration suits it

The editor SHALL recommend one named configuration for a given change,
and SHALL show the observations it was chosen from alongside it.

A recommendation whose grounds are hidden can only be accepted or
ignored, never disagreed with — and the cases where a reader would
disagree are exactly the cases where the recommendation is worst.

Where little is known about the change, the recommendation SHALL say so
where it gives its answer. Presenting a default silently makes "nothing
is known about this change" indistinguishable from "this is what the
evidence suggests".

The recommendation SHALL NOT propose a spending or time figure derived
from one change's own history. Most changes have a single recorded run
and many have none that reported a cost; a figure drawn from that is
arithmetic presented as evidence.

Applying it SHALL be an action a person takes, not something that happens
on their behalf.

#### Scenario: A change with no history

- **WHEN** a recommendation is asked for a change nothing has run against
- **THEN** one is given, and it states that there is no previous run to
  go on

#### Scenario: A change whose previous run hit a ceiling

- **WHEN** the change's last run ended at a configured ceiling
- **THEN** the recommendation allows more room and names the ceiling that
  was reached

#### Scenario: A change that has hit a ceiling repeatedly

- **WHEN** a change has been stopped at a ceiling more than once at the
  most generous configuration
- **THEN** the recommendation says a person should look, rather than
  proposing something larger again

#### Scenario: The grounds are visible

- **WHEN** a recommendation is shown
- **THEN** the observations behind it are shown with it
