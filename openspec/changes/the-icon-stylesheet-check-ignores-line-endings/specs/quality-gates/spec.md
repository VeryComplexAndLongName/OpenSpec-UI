## ADDED Requirements

### Requirement: A generated file's check ignores line endings

A test that compares a checked-in generated file with what its build
script produces SHALL compare them with line endings made alike, so a
checkout that converts line endings does not fail it. Any other difference
SHALL still fail it.

#### Scenario: A Windows checkout

- **WHEN** git has checked the generated icon stylesheet module out with
  CRLF line endings and nothing else differs
- **THEN** the check passes

#### Scenario: The generated file is stale

- **WHEN** the vendored subset changed without the module being rebuilt
- **THEN** the check fails, on every platform
