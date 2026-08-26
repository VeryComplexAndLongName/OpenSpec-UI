## ADDED Requirements

### Requirement: A global command compares several changes on a shared timeline

The system SHALL offer a Command Palette command, not tied to any
single tree item, that lets the user select multiple active and/or
archived changes and shows them as parallel lanes on a shared,
log-scaled time axis derived from the selected changes' own data. The
axis SHALL use a logarithmic scale from the range start, chosen because
it spreads a dense cluster of near-simultaneous changes into readable
detail rather than compressing it further.

#### Scenario: User selects changes across active and archived

- **WHEN** the user invokes "Show Change Comparison Timeline" and
  selects both active and archived changes
- **THEN** a webview opens showing one lane per selected change, points
  positioned by their best-effort dates

#### Scenario: User selects no changes

- **WHEN** the user cancels the selection without picking any change
- **THEN** no webview opens

#### Scenario: The comparison computation fails

- **WHEN** fetching the selected changes' timelines throws
- **THEN** the extension shows an error message and does not open a
  webview
