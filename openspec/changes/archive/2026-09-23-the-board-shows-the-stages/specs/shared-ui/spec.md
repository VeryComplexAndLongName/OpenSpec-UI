## ADDED Requirements

### Requirement: The Pipeline arranges its cards by stage

The Pipeline SHALL offer two arrangements of the same cards: by what each
change waits for, and as a board with a column per stage. The board SHALL
keep a column for every stage, empty or not, in the order Proposed,
Planned, In progress, In review, Landed, Archived, each headed by that
stage's word. It SHALL draw no line between cards on the board, and report
no cycle there: what blocks a change is on its card, in either
arrangement.

The arrangement SHALL be offered only where the host reads the stages, and
SHALL be kept for the next visit with the zoom and the open cards.

#### Scenario: Switching to the board

- **WHEN** a person presses "By stage" on a Pipeline drawing a change that
  waits for another
- **THEN** the columns become the stages, and the line between the two
  cards is gone

#### Scenario: A host that does not read the stages

- **WHEN** a host passes no reading of the stages
- **THEN** no arrangement is offered, and the picture is the declared
  order as before

### Requirement: A card says where its change is and who holds it

Where the stages were read, every card SHALL say the stage its change is
in, how long it has been there, and its Owner and Implementer, in core's
words, in either arrangement.

#### Scenario: A change in review

- **WHEN** a change has been in review for four hours, owned by ada and
  implemented by bob
- **THEN** its card says "In review for 4h, ada owns it, bob implements
  it"
