## ADDED Requirements

### Requirement: Durable outage catch-up without duplicate writes
Publication recovery SHALL retain overdue work, confirmed outcomes and attempt history across restarts. Repeated discovery SHALL not duplicate jobs. Retained manifests SHALL not silently evict undiscovered release candidates. A candidate safety-bound overflow SHALL fail visibly. Publishing an older npm version SHALL not downgrade latest. Uncertain personal LinkedIn creates and exhausted attempts SHALL remain visible for operator reconciliation rather than automatically replaying writes.

#### Scenario: Multiple publications became due while offline
- **WHEN** the server resumes with overdue items and retained confirmations
- **THEN** eligible unpublished items remain discoverable and confirmed items are not published again

#### Scenario: An old npm attempt resumes late
- **WHEN** a newer version is already latest
- **THEN** publishing an older missing version preserves the newer latest tag

#### Scenario: Discovery exceeds its retained candidate bound
- **WHEN** the producer would exceed one thousand retained release candidates
- **THEN** it fails visibly without dropping old candidates
