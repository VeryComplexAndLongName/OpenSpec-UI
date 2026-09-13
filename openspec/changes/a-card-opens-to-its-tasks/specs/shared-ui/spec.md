## ADDED Requirements

### Requirement: A card opens to list its change's tasks

A card SHALL offer to open and to close. An open card SHALL list its
change's tasks in the order of the change's task list, under that list's
section headings.

Each task SHALL state, in words, one of: done, in hand, probably next,
open, only a person can close it, or delegated to a named agent. At most
one task SHALL be in hand or probably next.

Opening a card SHALL NOT change what any card says.

#### Scenario: Opening a card

- **WHEN** a reader opens a card whose change has six tasks under two
  headings
- **THEN** the card lists all six tasks under both headings, in the list's
  order, each with its state in words

#### Scenario: A delegated task

- **WHEN** a task is marked as delegated to an agent
- **THEN** its row names that agent

### Requirement: A line inside a card means listed next, and a legend says so

A thin line inside a card SHALL join each task to the task listed after it,
and SHALL mean only that.

The line between cards SHALL continue to mean a declared order and nothing
else.

Where the picture shows either kind of line, a legend SHALL state what each
kind means, and SHALL state that a collision is written on the card and not
drawn.

No line SHALL be drawn between two tasks for any reason other than their
order in the list.

#### Scenario: A picture with an open card

- **WHEN** a card is open
- **THEN** the legend states what the thin line and the line between cards
  mean

### Requirement: An open card's size is derived, not measured

An open card's height SHALL be derived from the number of its task rows and
section headings, in the same units as its position, and SHALL NOT be
measured after drawing.

Each column SHALL place its cards one below another by their heights.
Opening a card SHALL move only the cards below it in its own column.

A line between cards SHALL meet a card at the card's head, which opening
the card does not move.

#### Scenario: Opening a card in a column of three

- **WHEN** the first of three cards in a column is opened
- **THEN** the other two move down by the open card's extra height, and no
  card in another column moves

### Requirement: The picture can be zoomed, and remembers how it was left

The picture SHALL offer to zoom in, to zoom out, and to reset the zoom. A
zoom SHALL scale the cards, their text and the lines together, so that
every line a card draws at one zoom it also draws whole at another.

The zoom, and which cards are open, SHALL be remembered for the viewer in
that host. A host that cannot store them SHALL still show the picture, with
the default zoom and every card closed.

#### Scenario: Zooming in

- **WHEN** a reader zooms the picture to 150%
- **THEN** every card and line is drawn larger, and no card cuts any line
  of its text

#### Scenario: Returning to the tab

- **WHEN** a reader opens a card, zooms, and later returns to the tab
- **THEN** that card is still open and the zoom is unchanged

## MODIFIED Requirements

### Requirement: A card shows only whole lines of its text

A closed card SHALL draw only the lines of its text that fit whole, and
SHALL NOT draw part of a line.

Which lines fit SHALL be derived from the card's size, not measured after
drawing.

Lines that do not fit SHALL remain available on the card to assistive
technology and in its full text, and the card SHALL show that there is
more.

An open card SHALL be tall enough to draw every one of its task rows whole.

#### Scenario: More text than room

- **WHEN** a closed card's text has more lines than its size holds
- **THEN** the card draws the lines that fit whole, shows that there is
  more, and keeps every line available

#### Scenario: An open card with many tasks

- **WHEN** a card with twenty tasks is open
- **THEN** every task row is drawn whole inside the card
