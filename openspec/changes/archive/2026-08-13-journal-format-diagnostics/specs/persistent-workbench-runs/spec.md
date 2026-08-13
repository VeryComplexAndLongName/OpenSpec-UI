## ADDED Requirements

### Requirement: Run recovery fails closed for incompatible persisted formats
The system SHALL reject unsupported journal and checkpoint versions without
moving, rewriting, or deleting the persisted journal.

#### Scenario: Older delivery opens a future journal version
- **WHEN** the persisted journal version is newer than the bundled core supports
- **THEN** recovery fails with an upgrade-required diagnostic
- **AND** the journal remains byte-for-byte unchanged at its original path

#### Scenario: Journal contains a future checkpoint version
- **WHEN** the journal version is supported but a checkpoint version is not
- **THEN** recovery fails with a checkpoint compatibility diagnostic
- **AND** the journal remains byte-for-byte unchanged

#### Scenario: Journal JSON is malformed
- **WHEN** the journal cannot be parsed as JSON
- **THEN** recovery fails with a corruption diagnostic distinct from version compatibility

#### Scenario: Host presents a recovery failure
- **WHEN** core rejects persisted recovery state
- **THEN** the host displays the actionable core diagnostic
- **AND** does not infer compatibility by parsing human-readable error text