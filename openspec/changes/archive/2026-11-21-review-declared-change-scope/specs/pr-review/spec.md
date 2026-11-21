## ADDED Requirements

### Requirement: PR Review identifies paths outside a declared change scope

For the displayed committed comparison, both hosts SHALL report paths outside the optional `change-scope.json` committed beside the proposal. Exact file paths and directory prefixes ending in a slash SHALL use case-sensitive Git paths and path boundaries. The change's own planning directory SHALL be included implicitly. The report SHALL account for both paths of a rename and retain its qualifications in Copy PR summary. Opening the review SHALL remain read-only.

#### Scenario: An agent changes an unrelated file

- **WHEN** a comparison changes files inside and outside an explicitly declared directory
- **THEN** the review identifies the outside paths and the total outside count
- **AND** it labels the result as an advisory comparison against the declaration rather than proof of requirement completion or permission enforcement

#### Scenario: A rename crosses the declared boundary

- **WHEN** a committed rename moves a file between allowed and undeclared paths
- **THEN** scope analysis considers both the old and new paths even when the displayed patch identifies a rename

#### Scenario: The declaration cannot establish agreed scope

- **WHEN** the declaration is missing, malformed, unsafe or new/changed during the comparison, or the comparison is unavailable
- **THEN** the review reports the relevant uncertainty and does not claim the change stayed within an agreed plan

#### Scenario: Only declared implementation and planning paths changed

- **WHEN** all changed paths match a valid declaration or the selected change's own planning directory
- **THEN** the review reports zero outside paths for those comparison endpoints
- **AND** it still discloses any change to the declaration itself
