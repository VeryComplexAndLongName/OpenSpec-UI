## ADDED Requirements

### Requirement: A finished run leaves nothing armed

When an agent run ends, the machinery that ran it SHALL leave no timer
armed.

A timer outliving its run holds the process open — a cancelled CLI run
waits for it before exiting — and fires into a stream that has already
terminated. That it does no visible harm today is a property of the
current loop rather than anything guaranteed.

#### Scenario: A cancelled run that the process survived by dying

- **WHEN** a run is cancelled and the child process exits
- **THEN** the stream ends and no timer remains armed
