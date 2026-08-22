## MODIFIED Requirements

### Requirement: Checkpoint persistence excludes sensitive and generated state

The workbench SHALL omit sensitive environment files, generated caches, and
local virtual environments from checkpoint capture and rollback data.

#### Scenario: Capture a workspace containing generated local state

- **WHEN** a checkpoint is captured for a workspace containing `.env`, a local
  virtual environment, or a supported generated cache directory
- **THEN** those paths are not read into the checkpoint
- **AND** ordinary workspace files remain covered by rollback

#### Scenario: Restore a historical checkpoint

- **WHEN** a version-1 run journal contains paths that are excluded by the
  current checkpoint policy
- **THEN** recovery removes those paths from the checkpoint snapshots and delta
- **AND** the sanitized journal is persisted without deleting workspace files