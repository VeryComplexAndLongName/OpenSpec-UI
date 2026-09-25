## MODIFIED Requirements

### Requirement: The Pipeline arranges its cards by stage

The Pipeline SHALL offer two arrangements of the same cards: by what each
change waits for, and as a board with a column per stage. The board SHALL
keep a column for every stage, empty or not, in the order Drafted,
Proposed, Planned, In progress, In review, Landed, Archived, each headed by that
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

**The board SHALL show every active change of the repository, wherever it
is worked**: this working directory's and every other working directory's,
one card per change. A change worked in two places SHALL stand on the
board once. A card for a change of another working directory SHALL say
which directory works it, and SHALL offer no action on it: a change is the
pair of a directory and a name, and nothing drawn here may reach the
change of that name in this checkout. Such a card SHALL NOT also be drawn
under the other working directories, which is where it stood before.

A board is of the work and not of one folder: one person with several
working directories has one flow of work, and splitting it by folder hides
the board's whole subject. The arrangement by declared order SHALL keep to
this checkout: an order is what this repository declares here, and another
directory's order is its own.

Each of the board's columns SHALL be separated from the next by a rule,
and SHALL carry, in its heading: the stage's word, a picture that stands
for that stage, how many changes stand in the column, and a colour of that
stage's own. The other arrangement SHALL carry none of these: its columns
are a sequence, and a rule there would assert a boundary nothing has.

The colour SHALL be a palette token named once, for every surface, and
each palette SHALL give that token a value - in the editor, from the
editor's own theme. Colour SHALL NOT be the only thing that carries the
distinction: the word is always there, and the picture agrees with it. The
count SHALL be readable by a reader who hears the heading rather than
seeing it.

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

#### Scenario: A change worked in another directory

- **WHEN** another working directory of this repository holds a change
  this checkout does not, and the board is chosen
- **THEN** its card stands in its own stage's column, says which directory
  works it, offers no action on it, and is not drawn again under the other
  working directories

#### Scenario: A change worked in two directories

- **WHEN** the same change is worked here and in another directory
- **THEN** one card stands on the board, this checkout's own

#### Scenario: A column's heading

- **WHEN** two changes stand in In progress and none in Proposed
- **THEN** the In progress heading carries its word, its picture, its own
  colour and the figure 2, and the Proposed heading carries the figure 0

#### Scenario: The rules between columns

- **WHEN** the board is drawn
- **THEN** a rule stands between each column and the next, and none before
  the first

#### Scenario: The other arrangement

- **WHEN** the arrangement by declared order is chosen
- **THEN** no rule, picture, colour or count is drawn on its headings, and
  the other working directories' changes are drawn under them as before

#### Scenario: A host that does not read the stages

- **WHEN** a host passes no reading of the stages
- **THEN** no arrangement is offered, and the picture is the declared
  order as before

#### Scenario: A change made before its proposal

- **WHEN** a change's directory holds no proposal and the board is chosen
- **THEN** its card stands in the Drafted column, and Start on it begins at
  propose
