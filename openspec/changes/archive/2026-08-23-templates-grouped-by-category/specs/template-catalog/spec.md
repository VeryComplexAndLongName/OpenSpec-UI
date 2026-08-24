## MODIFIED Requirements

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
