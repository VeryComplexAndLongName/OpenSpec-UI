## ADDED Requirements

### Requirement: Project-level templates can be deleted through the product

The system SHALL let the user permanently delete a project-level
template (`openspec/templates/<id>/` and its contents) through both
delivery targets, after an explicit confirmation step. Built-in
templates SHALL NOT offer a delete action anywhere in either delivery
target's UI — they have no on-disk representation in the target
workspace to delete.

#### Scenario: Deleting an existing project-level template

- **WHEN** the user confirms deletion of project-level template `X`
- **THEN** `openspec/templates/X/` no longer exists, and `X` no longer
  appears in the template list

#### Scenario: Deleting an unknown project-level template id

- **WHEN** the requested id has no matching `openspec/templates/<id>/`
  directory
- **THEN** the system reports a clear "not found" error and makes no
  filesystem change

#### Scenario: Built-in tree/tab items never offer delete

- **WHEN** the user views a built-in template in either delivery
  target's UI
- **THEN** no delete action is available for it
