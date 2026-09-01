## ADDED Requirements

### Requirement: The default allowlist admits one validated model argument

For an adapter that accepts a model, the default allowlist SHALL permit
that adapter's fixed argument shape optionally followed by exactly one
model flag and exactly one model value, and SHALL permit no other
variation. The model value SHALL satisfy the same character restriction
enforced when the configuration was read.

For an adapter that accepts no model, the allowlist SHALL keep matching
its argument shape exactly, unchanged.

#### Scenario: Invocation without a model

- **WHEN** a model-capable adapter is invoked with its fixed arguments
  and no model
- **THEN** the allowlist permits it, exactly as before this capability
  existed

#### Scenario: Invocation with one valid model argument

- **WHEN** a model-capable adapter is invoked with its fixed arguments
  followed by one model flag and one permitted value
- **THEN** the allowlist permits it

#### Scenario: Invocation carrying more than one model argument

- **WHEN** an invocation carries a second model flag, a model flag with
  no value, or a value outside the permitted character set
- **THEN** the allowlist refuses it and the process is not started
