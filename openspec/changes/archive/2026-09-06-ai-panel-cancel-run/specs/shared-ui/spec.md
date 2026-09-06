## ADDED Requirements

### Requirement: A run started in the AI panel can be cancelled from it

While a run started from the AI panel is in flight, the panel SHALL offer
a control that cancels it.

That control SHALL cancel the run that is in flight, identified by the run
it was started as, and SHALL NOT start a new one.

The control SHALL be offered only while a run is in flight.

This SHALL NOT depend on the autonomy level, because a single-stage run is
available at every autonomy level.

#### Scenario: Cancelling an in-flight run

- **WHEN** a run started from the AI panel is in flight and the cancel
  control is used
- **THEN** that run is cancelled

#### Scenario: No run in flight

- **WHEN** no run is in flight
- **THEN** the panel offers no cancel control

#### Scenario: The run ends between offering and using the control

- **WHEN** a run reaches a terminal outcome and the cancel control is used
  immediately afterwards
- **THEN** nothing is started, no error is reported, and the panel
  continues to show that run's terminal outcome

#### Scenario: A run that names no change

- **WHEN** a run that operates on no particular change is cancelled
- **THEN** it is cancelled the same way as a run that names one
