## ADDED Requirements

### Requirement: OpenSpec view summary lists are searchable by name or status

The standalone "OpenSpec view summary" tab SHALL render its active
changes as a searchable list (matching by name or by status label),
replacing a static, non-interactive table, and SHALL additionally render
an Archive section, also searchable, listing archived changes (not
previously shown in this tab). Archived changes SHALL display real
task-completion progress and a last-modified date, sourced from
`execution-core`, rather than only a name.

#### Scenario: User filters active changes by name

- **WHEN** the user types part of a change's name into the Changes
  section's search box
- **THEN** only active changes whose name matches remain visible

#### Scenario: User filters active changes by status

- **WHEN** the user types a status word (e.g. "progress") into the
  Changes section's search box
- **THEN** only active changes whose displayed status label matches
  remain visible

#### Scenario: User filters archived changes

- **WHEN** the user types into the Archive section's search box
- **THEN** only archived changes matching by name or status label remain
  visible, sorted by last-modified date

#### Scenario: Archived changes show real progress

- **WHEN** the Overview tab loads a workspace with archived changes
- **THEN** each archived change displays its actual completed/total task
  count and a last-modified date, not just its name
