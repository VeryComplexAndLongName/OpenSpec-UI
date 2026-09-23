## MODIFIED Requirements

### Requirement: The Pipeline arranges its cards by stage

The Pipeline SHALL offer two arrangements of the same cards: by what each
change waits for, and as a board with a column per stage. The board SHALL
keep a column for every stage, empty or not, in the order Proposed,
Planned, In progress, In review, Landed, Archived, each headed by that
stage's word. It SHALL draw no line between cards on the board, and report
no cycle there: what blocks a change is on its card, in either
arrangement.

The board SHALL be drawn whenever it is chosen, including where no change
stands on it at all, and SHALL then say why it is empty. A board whose
columns appeared only once something stood in them says nothing about the
way through, and a person who presses "By stage" and sees nothing cannot
tell a board with nothing on it from a control that does not work.

The board SHALL show a change that has landed, in its column. The other
arrangement folds those away, which is right where landing is not a place;
on a board Landed is a column, so folding empties it by construction and
hides the one thing the board exists to show.

The arrangement SHALL be offered only where the host reads the stages, and
SHALL be kept for the next visit with the zoom and the open cards.

#### Scenario: Switching to the board

- **WHEN** a person presses "By stage" on a Pipeline drawing a change that
  waits for another
- **THEN** the columns become the stages, and the line between the two
  cards is gone

#### Scenario: A board with nothing on it

- **WHEN** a person presses "By stage" where no change is drawn
- **THEN** every column is drawn, headed and empty, and the view says that
  every column is empty and why

#### Scenario: A change that has landed

- **WHEN** a change has landed and the board is chosen
- **THEN** its card stands in the Landed column rather than being folded
  away

#### Scenario: A host that does not read the stages

- **WHEN** a host passes no reading of the stages
- **THEN** no arrangement is offered, and the picture is the declared
  order as before

### Requirement: A working directory is labelled, and the label is not an identity

Each working directory SHALL carry a label.

Where the directory declares none, its own directory name SHALL be used,
so that a directory that declares nothing is still named.

The label SHALL be reported as self-declared. Nothing SHALL be permitted
or refused on the strength of it.

Where a card says that the same change is also worked in another
directory, the main checkout SHALL be named for what it is rather than by
its label. That label is the name of whichever folder the repository was
cloned into: it says nothing about the place, and may be read as something
else entirely - on this repository it is the product's own name. A
directory's own heading SHALL keep its own label, which is what a label is
for.

#### Scenario: A directory that declares nothing

- **WHEN** a working directory carries no declared label
- **THEN** it is named by its directory name

#### Scenario: A directory that declares a label

- **WHEN** a working directory declares a label
- **THEN** that label names it

#### Scenario: A change also worked in the main checkout

- **WHEN** a card in another working directory says where else its change
  is worked, and one of those places is the main checkout
- **THEN** it names it as the main working directory, not by the folder's
  name
