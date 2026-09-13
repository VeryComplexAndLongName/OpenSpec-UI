## ADDED Requirements

### Requirement: Each reading is shown when it arrives

The picture of the other working directories SHALL be shown whether
this directory's own reading is still being taken, has arrived, or has
failed.

#### Scenario: This directory is still being read

- **WHEN** the other working directories have been read and this
  directory's reading has not arrived
- **THEN** the other working directories are shown, beside a note that
  this directory is still being read

#### Scenario: This directory could not be read

- **WHEN** this directory's reading fails and the other working
  directories were read
- **THEN** the failure is shown, and so are the other working directories

### Requirement: A card shows only whole lines of its text

A card of fixed size SHALL draw only the lines of its text that fit
whole, and SHALL NOT draw part of a line.

Which lines fit SHALL be derived from the card's size, not measured
after drawing.

Lines that do not fit SHALL remain available on the card to assistive
technology and in its full text, and the card SHALL show that there is
more.

#### Scenario: More text than room

- **WHEN** a card's text has more lines than its size holds
- **THEN** the card draws the lines that fit whole, shows that there is
  more, and every line remains available
