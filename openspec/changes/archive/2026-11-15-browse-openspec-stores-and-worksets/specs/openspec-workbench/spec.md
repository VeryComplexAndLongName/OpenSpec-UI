## ADDED Requirements

### Requirement: Workbench displays OpenSpec stores and saved worksets

Both hosts SHALL offer a read-only Workspace view that lists locally registered OpenSpec stores and saved worksets with their member paths. A selected registered store SHALL expose its available specification identifiers and counts. The view SHALL explain when the installed upstream CLI cannot provide a listing.

#### Scenario: A workspace uses a registered planning store

- **WHEN** the operator opens the Stores and Worksets view and selects a registered store
- **THEN** the view lists that store's specifications and shows the paths and members of saved worksets.
