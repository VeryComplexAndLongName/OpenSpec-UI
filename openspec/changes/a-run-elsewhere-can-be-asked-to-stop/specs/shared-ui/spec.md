## ADDED Requirements

### Requirement: A card offers Stop for another host's run only when a signature shows it is the asker's

A card for a run that another host started SHALL offer Stop only when the
run's record is verified as signed by the same enrolled person as this
host's own key.

Otherwise the card SHALL state whose the run is, or that it is not
verified, and SHALL NOT offer Stop.

Until the run's record shows that it read the request, the card SHALL say
that a stop was requested and is waiting to be read. The card SHALL NOT say
that the run refused.

#### Scenario: The person's own run in another working directory

- **WHEN** a run elsewhere is verified as signed by this host's person
- **THEN** its card offers Stop, asking for a reason

#### Scenario: Somebody else's run

- **WHEN** a run elsewhere is verified as signed by another person
- **THEN** its card names that person and offers no Stop

#### Scenario: A request not yet read

- **WHEN** a stop has been requested and the run's record does not yet show
  it
- **THEN** the card says the request is waiting to be read
