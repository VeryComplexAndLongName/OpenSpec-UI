## ADDED Requirements

### Requirement: PR Review can import a report from an identified CI execution

Both hosts SHALL accept a Gitea Actions run ID or GitLab job ID for the
configured repository. Core SHALL validate the provider metadata and require
the producer's checkout identity to match the reported commit. The retained
JUnit summary SHALL identify the source and distinguish historical evidence.
Manual imports SHALL retain their user-declared attribution.

#### Scenario: A CI execution provides an attributable report

- **WHEN** the reviewer imports a report whose checkout identity matches the authenticated execution metadata
- **THEN** PR Review shows the source run or job and the report revision next to the results

#### Scenario: Report provenance or contents cannot be accepted

- **WHEN** the artifact is expired, unavailable, unsafe, or carries a different revision from its execution, or the displayed head moved
- **THEN** the import is refused and the prior report is preserved
