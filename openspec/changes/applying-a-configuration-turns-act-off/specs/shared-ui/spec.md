## ADDED Requirements

### Requirement: A change's Harness Settings turn Act off when the level leaves Autonomous

When a change's Harness Settings have Act chosen and the autonomy level
is set to anything but Autonomous, by hand or by a named configuration,
the view SHALL say that Act turns off when the form is saved, and saving
SHALL write the change's file without `supervisor.mode`, keeping its
fallback agents and allowances. Saving SHALL NOT be refused for it.

#### Scenario: The level moved away from Autonomous

- **WHEN** a change under Act has its autonomy level set to Inherit in its
  Harness Settings and is saved
- **THEN** the note under the supervisor said Act turns off on saving, and
  the saved file has no `supervisor.mode` and the same fallback agents
