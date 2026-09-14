## ADDED Requirements

### Requirement: A card starts its change through the run dialog

A card whose change can start SHALL offer Start. Start SHALL open the run
dialog for that change, and SHALL NOT start a run by itself.

A card whose change cannot start SHALL NOT offer Start.

#### Scenario: A ready change

- **WHEN** Start is used on the card of a ready change
- **THEN** the run dialog opens for that change, and no run starts until a
  path is chosen in it

#### Scenario: A blocked change

- **WHEN** a change is blocked
- **THEN** its card offers no Start

### Requirement: A run this host started is answered and stopped from its card

Where a change's run was started by the host that shows the card, the card
SHALL:

- say "Waiting for you" while the run waits, and offer to answer it;
- offer Stop, and ask for a reason;
- once a stop has been asked, offer Stop now, which terminates the run.

Where the run was started elsewhere, the card SHALL offer none of these. A
waiting run SHALL be described as answered where it was started. The card
SHALL show the folder the run was started in and offer to copy its path, and
SHALL NOT offer to open that folder.

#### Scenario: A checkpoint on this host's run

- **WHEN** a run this host started waits at a checkpoint
- **THEN** its card says "Waiting for you" and offers to continue or to stop

#### Scenario: Asking a run to stop

- **WHEN** Stop is used on a card and a reason is given
- **THEN** the run is asked to stop, the card says it was asked and why, and
  the card offers Stop now

#### Scenario: A run another host started

- **WHEN** a card's run was started by another host
- **THEN** the card offers no answer and no stop, and offers to copy the
  path of the folder the run was started in
