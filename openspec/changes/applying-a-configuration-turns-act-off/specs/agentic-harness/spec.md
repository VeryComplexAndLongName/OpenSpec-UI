## ADDED Requirements

### Requirement: Applying a configuration turns off an Act it leaves without Autonomous

Applying a named configuration to a change SHALL NOT fail because the
change's file has `supervisor.mode: "act"` and the configuration sets an
autonomy level other than `autonomous`. The written file SHALL instead
carry no `supervisor.mode`, SHALL keep the change's `supervisor.fallback`,
`allowCostIncrease` and `allowProviderChange`, and the surface that
applied it SHALL say that Act was turned off and why. A change's file
written by hand with `act` and another level SHALL still be refused.

#### Scenario: A named configuration over a change under Act

- **WHEN** a change's file sets `autonomyLevel: "autonomous"`,
  `maxStageAttempts: 2` and `supervisor` with `mode: "act"` and a fallback
  for apply, and Balanced is applied to it
- **THEN** the file is written with `autonomyLevel: "semi-autonomous"`, a
  `supervisor` with the fallback and no `mode`, and the applied note says
  the supervisor's Act is off because Balanced sets Semi-autonomous

#### Scenario: A hand-written contradiction

- **WHEN** a change's `harness.json` is written with `supervisor.mode:
  "act"` and `autonomyLevel: "semi-autonomous"`
- **THEN** the write is refused, naming the rule, as before
