## ADDED Requirements

### Requirement: The Timeline tab offers a compare-changes mode with a date-range picker

The system SHALL offer, within the existing Timeline tab, a mode that
lets the user pick a date range and select multiple active and/or
archived changes, then shows them as parallel lanes on a shared,
log-scaled time axis.

#### Scenario: User picks a date range and multiple changes

- **WHEN** the user selects a start date, an end date, and multiple
  changes, then loads the comparison
- **THEN** the tab shows one lane per selected change within that range

#### Scenario: User has not selected a range or any changes

- **WHEN** the user attempts to load a comparison without a complete
  date range or without selecting any change
- **THEN** the system reports what is missing rather than loading an
  empty or partial comparison
