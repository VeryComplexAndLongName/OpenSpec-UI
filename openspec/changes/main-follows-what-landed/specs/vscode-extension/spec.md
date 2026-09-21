## ADDED Requirements

### Requirement: The editor looks again after opening an archive

When the sweep opens an archive pull request, the editor SHALL run the
sweep once more about as long afterwards as the pull request's checks take,
so a merged archive reaches the checkout without waiting for the next
interval. Only one such sweep SHALL be pending at a time.

#### Scenario: An archive pull request is opened

- **WHEN** the sweep opens an archive pull request
- **THEN** the editor sweeps again 15 minutes later, once
