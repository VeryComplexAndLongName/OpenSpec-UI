## ADDED Requirements

### Requirement: PR Review can associate scenarios with imported JUnit testcases

Both hosts SHALL let a reviewer choose a committed scenario and search unique
classname/name pairs in the imported JUnit report. The picker SHALL identify
the report's declared commit and distinguish historical evidence. A mapping
preview SHALL leave files untouched. Separate confirmation SHALL append the
validated association to the change's local scenario-tests.json, preserving
other associations.

#### Scenario: Link a test from an imported report

- **WHEN** a reviewer picks a scenario and a unique testcase and confirms the mapping diff
- **THEN** the mapping file contains the exact classname and name
- **AND** the report explains that the mapping becomes review evidence after commit

#### Scenario: The selection or preview is stale

- **WHEN** the checked-out head, imported report, or mapping changes before saving
- **THEN** the save is refused and the user must start from fresh review evidence

#### Scenario: An imported identity is ambiguous

- **WHEN** an imported report lists more than one testcase with the same classname and name
- **THEN** the identity cannot be used to create a mapping through the picker
