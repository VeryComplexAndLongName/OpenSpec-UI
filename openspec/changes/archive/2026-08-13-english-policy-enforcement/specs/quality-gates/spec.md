## ADDED Requirements

### Requirement: New repository-authored text follows the English policy
The system SHALL fail the normal lint gate when a tracked authored file contains
new or modified unapproved Cyrillic text.

#### Scenario: Tracked source contains Cyrillic text
- **WHEN** a tracked Markdown, source, JSON, or YAML file contains Cyrillic text
- **AND** its path and normalized content do not match the reviewed legacy baseline
- **THEN** the lint gate fails with file and line diagnostics

#### Scenario: Reviewed legacy line remains unchanged
- **WHEN** a tracked line matches its reviewed baseline path and content hash
- **THEN** the scanner reports no new policy violation

#### Scenario: Intentional internationalization fixture is marked
- **WHEN** a fixture line contains Cyrillic text and an explicit policy marker
- **THEN** the scanner accepts that line

#### Scenario: Real CLI output fixture contains repository prose as data
- **WHEN** the scanner encounters the explicitly exempt captured CLI JSON fixture
- **THEN** it leaves the fixture byte-for-byte unchanged

#### Scenario: Generated files exist locally
- **WHEN** ignored build, dependency, or editor-test output contains Cyrillic text
- **THEN** the tracked-file scanner does not inspect that output