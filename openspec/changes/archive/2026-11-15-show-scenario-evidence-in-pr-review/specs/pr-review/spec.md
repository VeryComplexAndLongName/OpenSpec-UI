## ADDED Requirements

### Requirement: PR Review associates scenarios with observed checks

The review SHALL list scenario titles from added and modified requirements in the reviewed commit. An optional committed scenario-checks.json SHALL identify a capability, requirement, scenario and named checks. The review SHALL distinguish scenarios lacking an association from associated checks lacking a result, and SHALL disclose invalid mappings. Results SHALL be tied to the reviewed commit and included in Copy PR summary.

#### Scenario: A linked check appears in GitHub results

- **WHEN** a scenario maps to a unique named check and a refresh reports it for the reviewed commit
- **THEN** the scenario row shows the check's observed state.

#### Scenario: GitHub is reading a different commit

- **WHEN** the published PR head differs from the local comparison
- **THEN** the scenario row retains the declared association and names the revision mismatch.

#### Scenario: Several results share a check name

- **WHEN** a mapped name resolves to several results on the reviewed commit
- **THEN** the scenario row reports that the result cannot be uniquely identified.
