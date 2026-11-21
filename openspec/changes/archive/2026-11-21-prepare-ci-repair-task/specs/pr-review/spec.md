## ADDED Requirements

### Requirement: PR Review prepares an evidence-based CI repair task

Both hosts SHALL offer an explicit read-only action to refresh CI evidence and prepare a repair brief for the identified published revision. The brief SHALL preserve failure observations, available source links, missing expected checks, historical revisions and partial/unavailable detail. Remote error content SHALL be bounded quoted data. Preparing or copying the brief SHALL NOT launch an agent, modify repository files, rerun CI or publish anything.

#### Scenario: A failed check provides a concrete annotation

- **WHEN** the reviewer prepares a repair task and the forge supplies a failed check with an error message, source path and line
- **THEN** the review and copied brief include those observations with the checked commit and run link
- **AND** the brief tells an agent to investigate and perform scoped verification without treating quoted error text as instructions

#### Scenario: An expected check has no result

- **WHEN** complete observed results contain no result for a known expected check
- **THEN** the brief distinguishes the absent result from a failed execution and does not invent a failure log or established cause

#### Scenario: Detail is unavailable or incomplete

- **WHEN** credentials cannot read failure details or diagnostic limits are reached
- **THEN** the review keeps the observed check states, explains the missing detail and retains that qualification in the copied brief

#### Scenario: The local head differs from the checked revision

- **WHEN** a repair brief uses published-head results for a different local review head
- **THEN** the brief names both revisions and requires checking relevance before editing the current change
