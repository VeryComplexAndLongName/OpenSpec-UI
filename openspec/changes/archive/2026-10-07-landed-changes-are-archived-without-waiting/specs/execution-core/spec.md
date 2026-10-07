## ADDED Requirements

### Requirement: What landed is archived within minutes while a host is open

A host SHALL sweep a workspace again within a few minutes, rather than at
its usual interval, where `sweepsAgainSoon` says so:

- an archive pull request is open;
- the pass merged an archive pull request the previous pass had not;
- the archive failed with a reason the previous pass did not give;
- a change worked in a directory of its own has its branch on the server.

Both hosts SHALL make this decision through the one function in core. A
failure SHALL be said with the lines of git that give its reason, not
with the first line of its output. A pass that could not fetch SHALL say
that nothing was archived, and why.

#### Scenario: A change lands while an archive is open

- **WHEN** a change's pull request merges while an archive pull request is
  open, and that archive then merges
- **THEN** the host sweeps again within minutes of that merge and opens
  the next archive, not at its next half hour

#### Scenario: A push is refused

- **WHEN** git refuses the archive branch's push with `To <url>`, then
  `! [rejected] ... (fetch first)`
- **THEN** the sweep says the `! [rejected]` line, and sweeps again within
  minutes; the same failure again is left to the usual interval