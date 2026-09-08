## ADDED Requirements

### Requirement: Applying a named configuration preserves what it does not set

Applying a named configuration to a change SHALL set the keys that
configuration names and SHALL leave every other key in the change's
configuration unchanged.

The writer replaces the file, so a key absent from what is written is
deleted rather than left alone. A person applying a template to get a
cheaper run has not asked for the change's staging allowlist, its
hand-tuned ceilings or its review gate to be removed, and SHALL NOT have
that happen as a side effect.

#### Scenario: A change carrying settings the template does not mention

- **WHEN** a named configuration is applied to a change whose
  configuration contains keys that configuration does not set
- **THEN** the applied keys take the configuration's values and the
  others are still present, unchanged
