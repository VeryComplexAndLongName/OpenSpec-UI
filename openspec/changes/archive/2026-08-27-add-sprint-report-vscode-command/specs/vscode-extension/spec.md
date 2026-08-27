## ADDED Requirements

### Requirement: A global command generates a downloadable sprint report

The system SHALL offer a Command Palette command, not tied to any
single tree item, that lets the user select multiple active and/or
archived changes, enter a sprint start and end date, and save a
generated PDF sprint report to a location of their choosing.

#### Scenario: User generates and saves a sprint report

- **WHEN** the user invokes "Generate Sprint Report (PDF)", selects one
  or more changes, enters a valid start and end date, and confirms a
  save location
- **THEN** a PDF file is written to that location and a confirmation
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
- **THEN** no PDF file is written

#### Scenario: Report generation fails

- **WHEN** building the sprint report or rendering the PDF throws
- **THEN** the extension shows an error message and does not write a
  file
