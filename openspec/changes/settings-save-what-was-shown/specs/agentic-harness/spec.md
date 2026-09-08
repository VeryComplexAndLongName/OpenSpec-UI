## ADDED Requirements

### Requirement: Saving settings preserves configuration the view does not display

Saving from the harness settings view SHALL preserve every accepted
top-level configuration key, including keys the view has no field for.

Both configuration writers replace the file, so a key omitted from a save
is deleted rather than left alone. A person editing which agent runs
`apply` has not asked for a spending ceiling, a stage timeout, an attempt
count or the git staging allowlist to be removed, and SHALL NOT have that
happen as a side effect.

This SHALL hold for the global file and for a per-change override alike.

#### Scenario: A key the view cannot display survives a save

- **WHEN** a configuration containing keys the settings view has no
  fields for is loaded, a displayed field is changed, and the settings
  are saved
- **THEN** the saved configuration still contains those keys, unchanged

#### Scenario: An applied template's ceilings are saved

- **WHEN** a template is applied in the settings view and the settings
  are then saved
- **THEN** the saved configuration contains the ceilings that template
  sets, not only the fields the view displays

### Requirement: Templates are offered where a per-change configuration is edited

The settings view SHALL offer the templates that may be applied to a
change wherever a per-change override is edited, not only for the global
file.

A template whose scope is per-change only is otherwise unreachable: it is
correctly withheld from the global file, and there is nowhere else to
apply it from.

#### Scenario: A per-change-only template can be applied

- **WHEN** a per-change override is being edited
- **THEN** the templates available for a change are offered there,
  including those that may not be applied globally
