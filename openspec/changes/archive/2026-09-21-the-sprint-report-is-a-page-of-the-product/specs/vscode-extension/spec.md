## ADDED Requirements

### Requirement: A global command writes a sprint report page

The system SHALL offer a Command Palette command, not tied to any
single tree item, that lets the user select multiple active and/or
archived changes, enter a sprint start and end date, and save the
generated sprint report, as a page in the product's own look, to a
location of their choosing. It SHALL then offer to open that page, and
SHALL open it outside the editor, where printing to PDF is available.

#### Scenario: User generates and saves a sprint report

- **WHEN** the user invokes the command, selects one or more changes,
  enters a valid start and end date, and confirms a save location
- **THEN** the page is written to that location and a confirmation
  message offers to open it

#### Scenario: User selects no changes

- **WHEN** the user cancels the change selection without picking any
  change
- **THEN** no date prompt appears and no report is generated

#### Scenario: User enters a malformed date

- **WHEN** the user types a value that is not a valid `YYYY-MM-DD` date
  into either date prompt
- **THEN** the prompt reports the problem and does not accept the value

#### Scenario: User cancels the save dialog

- **WHEN** the user picks changes and a valid date range but dismisses
  the save dialog
- **THEN** nothing is written and no error is reported

## REMOVED Requirements

### Requirement: A global command generates a downloadable sprint report

**Reason**: The command wrote a PDF drawn by a library this product uses
for nothing else, which cost `core` a dependency and the extension's
bundle a special case. The page it writes instead is the product's own,
and the browser it opens in prints it.

**Migration**: The behaviour is described by "A global command writes a
sprint report page": the same picker, the same prompts and the same save
dialogue, writing `.html` rather than `.pdf`.
