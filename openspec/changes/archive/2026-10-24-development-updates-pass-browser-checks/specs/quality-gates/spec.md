## ADDED Requirements

### Requirement: Updated browser tools preserve usable controls and recordings

The browser suite SHALL pass with the updated axe and Playwright dependencies without suppressing serious accessibility rules.

#### Scenario: Pipeline control names contain the displayed labels

- **WHEN** Pipeline displays a zoom percentage or a task button
- **THEN** its accessible name includes that visible percentage or task text

#### Scenario: The tour is encoded by the bundled ffmpeg

- **WHEN** the tour's photographs are encoded with Playwright's installed ffmpeg
- **THEN** a WebM within the existing recording limits is produced
- **AND** an encoder failure is reported without an unhandled input-stream error
