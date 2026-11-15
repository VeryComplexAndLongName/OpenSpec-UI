## ADDED Requirements

### Requirement: Pipeline cards show specification overlaps before Apply

Both hosts SHALL offer Show Spec Overlaps on an active Pipeline card before Apply. The report SHALL use the same committed requirement analysis as Archive Preview. It SHALL show matching requirements changed since the common ancestor and the other locally known change branches that name those requirements. The report SHALL explain the commits and any unavailable or limited inputs. Opening the report SHALL leave the repository and running processes unchanged.

#### Scenario: Two parallel changes name the same requirement

- **WHEN** the operator selects Show Spec Overlaps before Apply for a committed change with a requirement also named in another local change
- **THEN** the report identifies the capability, requirement and other change
- **AND** it shows the committed versions available for comparing the requirement at the common ancestor, default branch and proposed delta

#### Scenario: No local history can establish a clean comparison

- **WHEN** committed deltas, default-branch history or part of the local branch list cannot be inspected
- **THEN** the report explains the unavailable information or inspection limit.
