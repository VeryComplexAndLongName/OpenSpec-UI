## ADDED Requirements

### Requirement: The time-budget rule is enforced by a check, not by memory

Where the repository requires a cost-varying check to state its own time
budget, that requirement SHALL be verified mechanically as part of the
lint gate, rather than relying on an author remembering it.

The verification SHALL name the file it rejects and say what is missing,
so the author can act on it without reading the spec first.

A check that matches the mechanical signal but is genuinely fixed-cost
SHALL be recorded as an explicit exemption with a stated reason, rather
than being made to carry a budget it does not need or silencing the
verification for everything.

#### Scenario: A new cost-varying check omits its budget

- **WHEN** a test that does filesystem work, spawns a process, or builds
  fixtures is added without a stated time budget
- **THEN** the lint gate fails and names that file

#### Scenario: A fixed-cost check matches the signal

- **WHEN** a check matches the mechanical signal but its cost does not
  vary with the machine
- **THEN** it is recorded as an exemption with a reason, and the lint
  gate passes

#### Scenario: The rule is met

- **WHEN** every cost-varying check states a budget or is a recorded
  exemption
- **THEN** the lint gate passes and reports nothing
