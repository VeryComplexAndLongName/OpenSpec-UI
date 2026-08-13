## ADDED Requirements

### Requirement: OpenSpec CLI JSON is validated at the core boundary
The system SHALL validate fields consumed by delivery adapters before returning
structured OpenSpec CLI results.

#### Scenario: CLI returns valid compatible output with additive fields
- **WHEN** a supported command returns all required fields plus unknown fields
- **THEN** core returns the result without discarding the additive fields

#### Scenario: CLI returns valid JSON with an incompatible shape
- **WHEN** a required consumed field is missing or has an incompatible type
- **THEN** core rejects the result with a typed compatibility diagnostic
- **AND** identifies the command and expected contract

#### Scenario: CLI returns malformed JSON
- **WHEN** a JSON command exits successfully but stdout is not valid JSON
- **THEN** core rejects the result with a typed invalid-JSON diagnostic

#### Scenario: Diagnostic includes CLI output
- **WHEN** core reports an output compatibility failure
- **THEN** the diagnostic includes only a bounded output preview
- **AND** does not expose unbounded child-process output