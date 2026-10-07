## ADDED Requirements

### Requirement: The AI panel follows its run to the end

The AI panel SHALL receive every event of a run it started until the run's
terminal event, however often its host renders it with new callbacks. A
transport SHALL NOT close the channel a run's events arrive on while a
component that unsubscribed subscribes again within the same task.

#### Scenario: The host renders during a run

- **WHEN** the standalone host renders the AI panel again, with a new
  `onRunTerminal`, while a run started from the panel is in flight
- **THEN** the panel keeps its one subscription, its socket stays open, and
  the run's later events, a permission request among them, reach it