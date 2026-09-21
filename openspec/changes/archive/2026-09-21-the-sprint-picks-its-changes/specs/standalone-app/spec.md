## ADDED Requirements

### Requirement: A sprint's changes are picked from a checklist

The standalone SHALL offer the changes a sprint report may cover as a
checklist:
- one row per change, saying whether it is archived or under way;
- the changes under way first, then the archived ones, newest first;
- a list that shows several rows and scrolls.

A search SHALL narrow the rows by every word typed, and SHALL keep what was
ticked. One control SHALL tick every change archived within the report's
range, and every change under way. Others SHALL tick all and none. A count
SHALL say how many of how many are chosen.

#### Scenario: A person picks a week

- **WHEN** the range is set to one week and a person presses
  "Archived in the range, and under way"
- **THEN** every change archived that week and every change under way is
  ticked, and the count says how many

#### Scenario: A person looks for one change

- **WHEN** a person types part of a change's name
- **THEN** only the changes whose names hold every word typed are shown,
  and what was ticked before stays ticked
