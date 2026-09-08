## ADDED Requirements

### Requirement: Two controls on one screen do not share a name

Where the harness dispatch entry and the chain panel are visible
together, their controls SHALL be named distinctly.

They do different things — one resolves the configuration and decides
where the run goes, the other starts the chain — and a shared label makes
the choice between them unreadable. It is worse than an unclear name,
because clicking the wrong one is not visibly wrong: the dispatch entry
appears to do nothing when the panel it would reveal is already open.

#### Scenario: Both are on screen

- **WHEN** the chain panel is shown beneath the harness dispatch entry
- **THEN** the two buttons carry different labels, and the one that
  starts the chain says so
