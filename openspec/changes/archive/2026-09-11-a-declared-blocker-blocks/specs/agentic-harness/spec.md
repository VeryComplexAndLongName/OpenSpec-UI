## ADDED Requirements

### Requirement: A chain does not start for a change its own declaration holds

Where a change declares that it is blocked by another change, and that
other change is still active, a chain for it SHALL be refused before its
first stage.

The refusal SHALL name the blocker. The remedy is not a setting: it is
to land that change or to remove the declaration, and the message SHALL
say which change is being waited for so either can be done.

A blocker that has been archived SHALL NOT hold anything. That is what
the declaration has always meant.

A declaration naming a change that does not exist SHALL NOT hold
anything either. That is a fault in the declaration, reported as one by
the check that validates relations, and holding the run on it would hide
the fault behind a refusal that reads as a schedule.

#### Scenario: A blocker that has not landed

- **WHEN** a chain is requested for a change declaring a blocker that is
  still an active change
- **THEN** the run is refused before the first stage, naming the blocker,
  and no agent was invoked

#### Scenario: A blocker that has landed

- **WHEN** the declared blocker has been archived
- **THEN** the run starts

#### Scenario: A declaration naming nothing that exists

- **WHEN** a change declares a blocker that is not a change of this
  repository
- **THEN** the run is not refused for that reason

### Requirement: A declared blocker is not a validation failure

A change that declares an unmet blocker SHALL remain valid.

The declaration states a plan, and a plan not yet carried out is not a
defect. Whether the repository validates and whether a run may start now
are different questions, and only the second one is answered by the
declaration.

#### Scenario: Validating a repository holding a blocked change

- **WHEN** the relations of a repository containing a change with an
  unmet blocker are checked
- **THEN** that change is not reported as invalid

### Requirement: A blocked change cannot be started by asking differently

There SHALL be no option that starts a chain for a change whose declared
blocker has not landed.

The declaration is a sentence its author wrote in a file under version
control. An option to override it would move that decision out of the
repository and into an invocation nobody reviews.

#### Scenario: Asking again

- **WHEN** a chain for a blocked change is requested in any way this
  system offers
- **THEN** it is refused
