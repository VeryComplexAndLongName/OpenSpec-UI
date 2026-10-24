## ADDED Requirements

### Requirement: The virtualizer update keeps production dependencies patched

The production dependency graph SHALL contain no undici release affected by GHSA-xjj6-f33q-929c.

#### Scenario: Audit after the TanStack update

- **WHEN** production dependencies from the updated lockfile are audited
- **THEN** npm audit reports no high or critical advisories
- **AND** the requested TanStack virtualizer version is retained
