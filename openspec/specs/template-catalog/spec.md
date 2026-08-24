# template-catalog Specification

## Purpose
Lets users start a new OpenSpec change from a curated, reusable starting
point (built-in or customized project-specific) instead of writing
proposal/design/tasks from scratch for recurring, well-understood
transformations.
## Requirements
### Requirement: Built-in templates are listed read-only

The system SHALL expose a fixed set of built-in templates, each with a
manifest (id, title, category, version, summary, variable definitions) and
three markdown artifacts (proposal, design, tasks). Built-in templates
SHALL NOT be modifiable in place.

#### Scenario: Listing templates for a workspace

- **WHEN** the user requests the template list for a workspace
- **THEN** all built-in templates are included regardless of the
  workspace's contents

### Requirement: Project-level templates live in the user's repository

The system SHALL read project-level templates from
`openspec/templates/<id>/` in the target workspace (a `template.json`
manifest plus the three markdown artifacts), alongside the built-in set.
Project-level templates SHALL be fully editable by the user through normal
file editing — the system SHALL NOT restrict how they are changed once
created.

#### Scenario: Workspace has a project-level template

- **WHEN** `openspec/templates/<id>/template.json` exists and is valid
- **THEN** it appears in the template list alongside built-in templates,
  distinguishable as project-level

### Requirement: Customizing a built-in template creates a backlinked fork

The system SHALL let the user create a project-level copy of a built-in
template ("customize"). The created copy's manifest SHALL record
`forkedFrom: { id, version }` identifying the exact built-in template and
version it was copied from. The system SHALL reject customizing into an
`id` that already exists at the project level rather than overwriting it.

#### Scenario: Customizing a built-in template

- **WHEN** the user customizes built-in template `X` at version `1.0.0`
- **THEN** `openspec/templates/X/template.json` is created with
  `forkedFrom: { id: "X", version: "1.0.0" }` and the built-in artifacts
  copied verbatim

#### Scenario: Customizing into an existing project template id

- **WHEN** `openspec/templates/X/` already exists in the workspace
- **THEN** the system rejects the customize request and does not modify
  the existing files

### Requirement: Rendering a template substitutes variables without writing to disk

The system SHALL render a template's three artifacts by substituting
`{{variableName}}` placeholders with caller-supplied values, and SHALL
return the rendered content without writing anything to disk. Missing
variable values SHALL leave the corresponding placeholder unchanged rather
than silently rendering an empty string.

#### Scenario: Rendering with all variables supplied

- **WHEN** the caller supplies values for every declared variable
- **THEN** the returned proposal/design/tasks content has all placeholders
  substituted and no file on disk is modified

#### Scenario: Rendering with a variable omitted

- **WHEN** the caller omits a declared variable's value
- **THEN** that variable's placeholder is left as-is in the rendered
  output, rather than being replaced with an empty string

### Requirement: Standalone shell exposes a Templates tab, hidden under the VS Code embed signal

The standalone shell SHALL add a "Templates" tab (browse built-in and
project templates, customize a built-in one, insert a rendered template
into the currently loaded Change Editor state) to its tab set. This tab
SHALL be excluded from the VS Code local-server embed's allowed tab set,
for the same reason as the other tabs VS Code already covers natively
(here: the VS Code Templates tree view). Within the tab, templates SHALL
be sorted and grouped by category (a subheader row per category
boundary), rather than presented in unsorted flat row order.

#### Scenario: Plain standalone browser tab

- **WHEN** the shell is loaded without the VS Code embed signal
- **THEN** the Templates tab is shown alongside the other tabs

#### Scenario: VS Code local-server embed

- **WHEN** the shell is loaded with the VS Code embed signal
- **THEN** the Templates tab is not shown

#### Scenario: Templates are grouped by category

- **WHEN** the Templates tab lists built-in and project templates
  spanning more than one category
- **THEN** the rows are sorted by category, with a subheader row marking
  each category boundary, instead of appearing in unsorted order

### Requirement: VS Code exposes a native Templates tree with customize and insert actions

The system SHALL provide a VS Code tree view listing built-in and
project-level templates, grouped first by origin (Built-in / Project)
and then by category as an intermediate, alphabetically-sorted subgroup
level under each origin — a template SHALL NOT appear as a direct child
of an origin group. Built-in items SHALL offer a "Customize" action. Any
item SHALL offer an "Insert into…" action that prompts for a
non-archived target change and the template's declared variables, then
inserts the rendered artifacts into that change's proposal/design/tasks
files as an undoable text edit — not a silent file write.

#### Scenario: Customizing a built-in template from the tree

- **WHEN** the user runs "Customize" on a built-in tree item
- **THEN** the corresponding project-level template appears in the tree
  under the project section, nested under its category subgroup

#### Scenario: Inserting a template into a change

- **WHEN** the user runs "Insert into…" on a template, supplies variable
  values, and picks a non-archived target change
- **THEN** the target change's proposal.md, design.md, and tasks.md open
  with the rendered content appended, as undoable edits

#### Scenario: Built-in and project templates are grouped by category in the tree

- **WHEN** the user expands the "Built-in" or "Project" group in the
  Templates tree
- **THEN** its children are category subgroups sorted alphabetically by
  category name, and expanding a category subgroup lists exactly the
  templates in that category

### Requirement: The project-level template manifest has VS Code schema validation

The system SHALL register a JSON Schema for `openspec/templates/*/template.json`
so VS Code's built-in JSON language features validate and autocomplete the
manifest without requiring a separate extension.

#### Scenario: Editing a manifest with an invalid field

- **WHEN** the user edits `template.json` and introduces a field that
  violates the schema
- **THEN** VS Code's native editor surfaces the validation error inline

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

