## ADDED Requirements

### Requirement: The standalone serves where each change is

The server SHALL answer `POST /api/change-stages` with one summary per
active change: its stage, since when, its Owner and Implementer, and the
time in each stage. It SHALL NOT include the visits themselves. A body
with no `cwd` SHALL be refused before anything is read, and a workspace
outside the allowed roots SHALL be refused as every other route refuses
one.

#### Scenario: The board's reading

- **WHEN** the Pipeline asks for the stages of a workspace
- **THEN** each active change comes back with its stage, since when, its
  roles and its totals, and no visits
