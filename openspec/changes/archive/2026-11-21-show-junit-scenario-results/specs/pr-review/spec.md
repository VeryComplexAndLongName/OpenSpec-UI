## ADDED Requirements

### Requirement: PR Review imports bounded JUnit evidence with explicit provenance

Both hosts SHALL allow an explicit JUnit XML import and a user-declared tested commit. The importer SHALL refuse malformed XML, DTDs, oversized or excessively nested reports, and requests whose displayed head is stale. The declared commit SHALL resolve locally. Opening a review SHALL neither run tests nor import a file. Only normalized testcase identities, outcomes, import time and the declared revision SHALL be retained locally across reopening and linked worktrees; raw XML, failure text and test output SHALL NOT be retained.

#### Scenario: Import a report in either host
- **WHEN** the user selects a valid report and declares a locally known tested commit while the displayed head is current
- **THEN** normalized evidence is saved and appears when the review is reopened
- **AND** the tested revision is labelled user-declared

#### Scenario: An unsafe or stale import
- **WHEN** the XML is malformed, contains a DTD, exceeds a limit, or the displayed head moved
- **THEN** the import is refused and previously saved evidence remains unchanged

### Requirement: Scenario test evidence preserves identity and uncertainty

The review SHALL read explicit scenario-to-testcase associations from committed scenario-tests.json at the displayed head. It SHALL match exact classname/name identities and distinguish passed, failed, error, skipped, missing and ambiguous outcomes. Invalid mappings and missing associations SHALL be visible. A report declared for another commit SHALL be labelled historical and SHALL NOT establish a current passing result. The review and Copy PR summary SHALL preserve these qualifications and SHALL NOT claim coverage from a job-level check.

#### Scenario: Each testcase outcome is visible
- **WHEN** a mapped scenario has passed, failed, error, skipped, missing or duplicate testcase identities in the imported report
- **THEN** the review names each observed state and ambiguous duplicates do not count as passed

#### Scenario: A later commit is reviewed
- **WHEN** the displayed commit differs from the report's declared tested commit
- **THEN** the report is historical and no mapped scenario is presented as passing on the displayed commit

#### Scenario: Associations are missing or invalid
- **WHEN** the committed mapping is missing, malformed, duplicates a scenario or names an absent scenario
- **THEN** the report discloses the missing or invalid associations without inventing matches
