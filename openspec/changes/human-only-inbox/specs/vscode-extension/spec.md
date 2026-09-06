## ADDED Requirements

### Requirement: What is waiting on a person is visible in one place

The extension SHALL present every open item that is marked as requiring a
person, across all active changes, in one place.

Each item SHALL name the change it belongs to and be reachable from it,
so that acting on it does not begin with a search.

The presentation SHALL NOT offer a way to mark such an item done. The
rule those items live by is that a person reports them done after
observing the thing; a control on a surface that cannot observe it would
turn the rule into a formality.

#### Scenario: Several changes are waiting on a person

- **WHEN** active changes carry open items marked as requiring a person
- **THEN** all of them are listed together, each naming its change

#### Scenario: Nothing is waiting

- **WHEN** no active change carries such an item
- **THEN** the surface says so rather than showing an empty list

#### Scenario: Acting on one

- **WHEN** one is selected
- **THEN** the change it belongs to is reachable from it

#### Scenario: The rule is not bypassed

- **WHEN** such an item is presented
- **THEN** no control marks it done from this surface
