## ADDED Requirements

### Requirement: An age on the picture keeps counting between readings

How long ago a run said something, and how long ago it was last heard
from, SHALL be counted from the times the run's record carries. It SHALL
NOT stay at the value measured when the picture was read.

Counting SHALL NOT read anything.

#### Scenario: A minute between readings

- **WHEN** a run said something 10 seconds before a reading, and 40
  seconds pass with no new reading
- **THEN** the picture says the run said it about 50 seconds ago

### Requirement: A host may tell the picture when to read

Where a host signals that what the picture reads has changed, the picture
SHALL read on that signal, and on a slow interval as a backstop, instead
of on its own shorter clock.

Where a host gives no signal, the picture SHALL read on its own clock, as
before.

#### Scenario: A host that signals

- **WHEN** the host signals that the survey has changed
- **THEN** the survey is read, and the readiness report is not

#### Scenario: A host that does not signal

- **WHEN** the host gives no signal
- **THEN** the picture reads on its own interval
