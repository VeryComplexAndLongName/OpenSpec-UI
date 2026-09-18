## ADDED Requirements

### Requirement: A change says it is blocked wherever it is listed

Wherever a change is listed with its state, that state SHALL account for the
order the workspace declares: a change whose `blocked_by` names another that
is still active SHALL be stated as blocked, and SHALL name what blocks it.

The Change Graph, the readiness reading and the command line all read that
order. Two listings did not: they asked for a change's word without the
readiness fact, and the word every unfinished change fell through to was
Ready. Reported by DW on 2026-09-18, with a screenshot of one change marked
ready in the list and blocked in the graph at the same moment.

A listing and the picture of the same workspace SHALL NOT disagree about one
change, and a check SHALL read both rather than one.

Where a change's tasks are all ticked and a blocker is still active, both
facts SHALL be stated: the word stays the one the closed set gives a
finished change, and being blocked is stated with it.

#### Scenario: A change blocked by an active change

- **WHEN** a change declares `blocked_by` on another that has not archived,
  and nothing is running for it
- **THEN** every listing states it as blocked and names the blocker

#### Scenario: The blocker archives

- **WHEN** the change that blocked it archives
- **THEN** the listings stop stating it as blocked, without being asked to
  read again by hand

#### Scenario: Finished, and still blocked

- **WHEN** every task of a blocked change is ticked
- **THEN** the listing states that its tasks are done and that it is still
  blocked

#### Scenario: The listing and the picture

- **WHEN** one workspace is read for a listing and for the picture of the
  declared order
- **THEN** the two say the same about each change, and a check reads both
