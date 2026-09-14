## ADDED Requirements

### Requirement: A form's sections are separated from each other

Where a form has more than one section, the end of each section, including
the control that saves or applies it, SHALL be separated from the next
section's heading by more space than separates the fields within a section.

Without that separation, the heading of the next section reads as if it
belonged to the save control above it.

#### Scenario: Two sections, one after the other

- **WHEN** a section ending in its save control is followed by another
  section
- **THEN** the gap between that control and the next heading is larger
  than the gap between two fields

### Requirement: A save is offered when there is something to save

A control that saves a settings form SHALL be enabled only while the form
differs from what was last loaded, applied or saved. While it differs, the
form SHALL say that it has unsaved changes.

#### Scenario: Nothing changed

- **WHEN** a settings form has just been loaded
- **THEN** its save control is disabled

#### Scenario: A field changed

- **WHEN** a field is changed
- **THEN** the save control is enabled, and the form says it has unsaved
  changes
