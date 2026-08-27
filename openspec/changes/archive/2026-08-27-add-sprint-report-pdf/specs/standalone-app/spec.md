## ADDED Requirements

### Requirement: The Timeline tab offers a downloadable sprint report

The system SHALL offer, within the Timeline tab, a mode where the user
picks a date range and multiple active and/or archived changes, then
downloads a generated PDF sprint report as a browser file download.

#### Scenario: User generates a sprint report

- **WHEN** the user selects a date range and one or more changes in the
  Sprint report mode and starts the download
- **THEN** a PDF file download begins, named after the selected range

#### Scenario: User has not selected a range or any changes

- **WHEN** the user attempts to generate a report without a complete
  date range or without selecting any change
- **THEN** the system reports what is missing rather than attempting
  to generate an empty or partial report
