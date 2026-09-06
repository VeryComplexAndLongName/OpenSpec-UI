## ADDED Requirements

### Requirement: A finished run does not report what it is doing

A run that has reached a terminal state SHALL NOT present live progress —
neither in its persisted record nor on any surface that displays it.
`state` already says the run is over, and a progress value shown beside
it contradicts that.

A field that describes work in flight SHALL be treated as belonging to
the run only while it is running, in the same way the reason a suspended
run is waiting belongs to it only while it waits.

Where a value recorded in that field is a statement about something that
happened rather than about work in flight — a workspace lease taken from
a holder that had stopped renewing it — it SHALL remain reachable. Such
evidence SHALL NOT be discarded to remove a display defect, and where it
is the only record of that event it SHALL NOT be deleted at all.

A marker written by a mechanism that no longer exists SHALL be dropped
from records already persisted, so that a record written before the fix
does not keep contradicting itself.

#### Scenario: A run finishes

- **WHEN** a run reaches a terminal state
- **THEN** the surface presenting it shows its state and does not show a
  progress value beside it

#### Scenario: A run is still going

- **WHEN** a run is running and reports its progress
- **THEN** that progress is shown, because it is what the run is doing

#### Scenario: The run had to reclaim the workspace lease

- **WHEN** a run took the workspace lease from a holder that had stopped
  renewing it, and has since finished
- **THEN** that fact is still reachable from the run's record

#### Scenario: A record written before this rule

- **WHEN** a persisted terminal record carries the obsolete marker
- **THEN** loading it yields a record without that marker, and every
  other recorded value is preserved
