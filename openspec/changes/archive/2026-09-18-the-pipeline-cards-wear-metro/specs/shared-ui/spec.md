## ADDED Requirements

### Requirement: A card's state, progress and next step stand out

A card SHALL show its state word in a badge whose colour agrees with the
word, and SHALL NOT convey the state by colour alone. It SHALL show how many
of its change's tasks are done as a bar beside the count.

A card's controls SHALL be told apart by what they do: the control that moves
the change forward SHALL look different from a control that stops a run, and
both from a control that only copies. A control's accessible name SHALL NOT
change with its look.

Each column of the picture SHALL be headed by its place in the order.

#### Scenario: A failed change beside a running one

- **WHEN** one change's last run failed and another's run is working
- **THEN** each card's badge carries its word, "Failed at verify" and
  "Running", in different colours, and each bar shows its tasks done

#### Scenario: A run waiting at a checkpoint on this host

- **WHEN** a run this host started waits to continue to verify
- **THEN** the card says so in a callout, "Continue to verify" is drawn as
  the forward control, and Stop is drawn as a stopping control

#### Scenario: Two columns

- **WHEN** one change waits on another
- **THEN** the first column is headed as the one that can start now, and the
  second as the one after it

### Requirement: A legend says what a line between cards means

Where the picture draws a line between two cards, a legend SHALL state that
the line means the second card waits for the first, and that a collision is
written on the card and not drawn.

#### Scenario: A picture with a declared order

- **WHEN** a change is blocked by another in the picture
- **THEN** the legend states what the line between them means

## MODIFIED Requirements

### Requirement: A card shows only whole lines of its text

A card SHALL draw only the lines of its text that fit whole, and SHALL NOT
draw part of a line.

A card's size SHALL be derived from what it holds, not measured after
drawing: its state, its progress, a waiting run's question, the facts it
draws, up to a fixed number, its controls, and, while it is open, its task
rows and headings.

Facts past that number SHALL remain available on the card to assistive
technology and in its full text, and the card SHALL show how many more there
are.

An open card SHALL be tall enough to draw every one of its task rows whole.

#### Scenario: More text than room

- **WHEN** a card has more facts than the number a card draws
- **THEN** the card draws that many whole, shows how many more there are,
  and keeps every fact available

#### Scenario: A busy card and a quiet one

- **WHEN** one card has a waiting run, four facts and controls, and another
  has only its state and progress
- **THEN** the first is taller than the second, and each draws every line
  whole

#### Scenario: An open card with many tasks

- **WHEN** a card with twenty tasks is open
- **THEN** every task row is drawn whole inside the card

### Requirement: A card states progress, the last run, and where its facts came from

A card SHALL state how many of its change's tasks are done, out of how many,
and how many open items only a person, or only another agent, can close.

A card SHALL state how the change's latest run ended, at which stage, and
how long ago. It SHALL state what the run cost where a cost was reported,
and SHALL NOT state a cost that was not reported.

A card SHALL name the working directory and the branch its facts were read
from.

Each fact a card states SHALL be marked by its kind, and the mark SHALL be
decoration: the words SHALL state the fact on their own.

#### Scenario: A run whose agent reported no cost

- **WHEN** the change's latest run recorded no usage
- **THEN** the card states how the run ended, and states no cost

#### Scenario: A change with its own worktree

- **WHEN** a change has a worktree of its own
- **THEN** its card states the task progress read from that worktree, and
  names that worktree and its branch

### Requirement: A card opens to list its change's tasks

A card SHALL offer to open and to close. An open card SHALL list its
change's tasks in the order of the change's task list, under that list's
section headings.

Each task SHALL state, in words, one of: done, in hand, probably next,
open, only a person can close it, or delegated to a named agent. At most
one task SHALL be in hand or probably next. Where a row draws a shorter tag
for its word, such as "A person" or the agent's name, the whole word SHALL
remain available on the row to assistive technology and in its full text.

Opening a card SHALL NOT change what any card says.

#### Scenario: Opening a card

- **WHEN** a reader opens a card whose change has six tasks under two
  headings
- **THEN** the card lists all six tasks under both headings, in the list's
  order, each with its state in words

#### Scenario: A delegated task

- **WHEN** a task is marked as delegated to an agent
- **THEN** its row names that agent

### Requirement: An open card's size is derived, not measured

Every card's height SHALL be derived from what it holds, open or closed, in
the same units as its position, and SHALL NOT be measured after drawing.

Each column SHALL place its cards one below another by their heights.
Opening a card SHALL move only the cards below it in its own column.

A line between cards SHALL meet a card at the card's head, which neither
opening the card nor what the card holds moves.

#### Scenario: Opening a card in a column of three

- **WHEN** the first of three cards in a column is opened
- **THEN** the other two move down by the open card's extra height, and no
  card in another column moves

## REMOVED Requirements

### Requirement: A line inside a card means listed next, and a legend says so

**Reason**: An open card lists its tasks as rows of a bordered list, where
the order of the rows is the order of the list; the thin line between rows is
not drawn.

**Migration**: The legend now explains only the line between cards, under
"A legend says what a line between cards means".
