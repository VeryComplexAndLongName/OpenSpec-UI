## ADDED Requirements

### Requirement: A failure is shown with its diagnosis

Where a host shows that a run failed, on a change's card, in a run's
panel or in its log, it SHALL show the failure's diagnosis with it: the
cause, whether repeating can help, the quoted line and the remedy. Both
hosts SHALL render it with one shared component, from the field the
event and the last run already carry, and SHALL NOT diagnose anything
themselves.

A failure without a diagnosis SHALL be shown as before.

#### Scenario: A card whose last run failed

- **WHEN** a change's last run failed diagnosed as "not signed in"
- **THEN** its card says the last run failed, and that the agent is not
  signed in and repeating will not help

#### Scenario: A chain that fails while watched

- **WHEN** a chain's stage fails with a diagnosis while its panel is open
- **THEN** the panel shows the failure reason, the diagnosis beneath it,
  and the remedy as text a person can copy

### Requirement: The Harness Settings views set the supervisor's mode

Both Harness Settings views, the global one and a change's own, SHALL
offer the supervisor's mode, Advise or Off, and SHALL save it with the
rest of the configuration.

#### Scenario: Turning it off for one change

- **WHEN** a person sets the supervisor to Off in a change's Harness tab
  and saves
- **THEN** that change's `harness.json` carries `supervisor.mode: "off"`
