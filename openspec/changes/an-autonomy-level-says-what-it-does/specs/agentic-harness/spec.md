## ADDED Requirements

### Requirement: A setting offers only values it would accept

Where a surface offers a choice of values for a setting, it SHALL offer
only those the same surface would accept when saved, at the scope the
control belongs to.

A value the control offers and the save refuses is worse than an absent
control: the reader makes a choice, is told it was wrong, and learns
nothing about why it was offered. The refusal already exists in the
writer; the offer is what has to agree with it.

Each value SHALL be named by what choosing it does. A label that
describes the implementation's history rather than the value's effect
gives the reader nothing to choose between, and goes stale without
anything noticing.

#### Scenario: A value valid only for a change

- **WHEN** the workspace-level section of the settings view offers
  autonomy levels
- **THEN** it offers only the levels a workspace-level file accepts

#### Scenario: The same value where it is valid

- **WHEN** the per-change section offers autonomy levels
- **THEN** it offers every level a change's own file accepts

#### Scenario: What a level is called

- **WHEN** an autonomy level is offered
- **THEN** its label says what running under it does
