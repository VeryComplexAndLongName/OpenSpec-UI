# change-disposition Specification

## Purpose
Let a team decide when to stop or resume a proposed change in the Pipeline while
retaining its decision history and planning artifacts.

## Requirements

### Requirement: A change can leave the active Pipeline without being archived

Workbench SHALL allow a user to record a change as deferred or cancelled with a
reason. The active Pipeline SHALL separate those changes from active work and
provide a way to restore the change. The decision SHALL retain the change's
artifacts and history and SHALL NOT synchronize or accept its proposed
requirements.

#### Scenario: A proposal is put aside

- **WHEN** the user defers or cancels an active change with a reason
- **THEN** the Pipeline shows its disposition and reason in the separate view
- **AND** the proposal, worktree, branch and base specifications are preserved

#### Scenario: Work is restored

- **WHEN** the user restores a deferred or cancelled change
- **THEN** it returns to the active Pipeline with its planning files and prior disposition history
