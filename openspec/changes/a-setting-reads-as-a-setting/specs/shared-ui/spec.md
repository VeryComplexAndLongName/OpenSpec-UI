## ADDED Requirements

### Requirement: A field's name is bound to its own control

A form field's name SHALL be nearer to the control it names than to
anything above it, and SHALL be distinguishable from surrounding prose
by more than colour alone.

Colour alone is insufficient twice over: it is the distinction a reader
who cannot see it loses entirely, and it is the one that fails a
contrast requirement first.

Where a row consists of a name and its value and nothing else, the name
SHALL occupy its own column rather than a line above the value.

#### Scenario: Reading a stack of fields

- **WHEN** several fields are shown one under another
- **THEN** each name sits closer to its own control than to the field
  above it

#### Scenario: A name beside prose

- **WHEN** a field's name appears alongside explanatory text
- **THEN** the two are told apart by weight or placement, not only by
  colour

### Requirement: A control is sized to the value it holds

A control SHALL take a width from the kind of value it holds rather than
filling the width available.

A dropdown holding one word SHALL NOT span the page. Its indicator sits
at its own edge, so an over-wide control puts the indicator far from the
value it belongs to and makes the pointer cross the page to reach it.

#### Scenario: A one-word choice

- **WHEN** a dropdown offers a small set of one-word values
- **THEN** it is about as wide as those values, and its indicator is
  beside them

#### Scenario: A sentence-long choice

- **WHEN** a control's values are sentences
- **THEN** it is wide enough for them

### Requirement: A commit is separated from what it commits

A control that saves or applies a section SHALL be separated from that
section by more space than separates the fields within it.

Sitting flush against the last field, it reads as part of that field
rather than as the end of the group.

#### Scenario: Saving a section of settings

- **WHEN** a section of settings ends with the control that saves it
- **THEN** there is more space above that control than between the
  fields above it

### Requirement: Every colour the shell draws comes from a named token

The shell's stylesheet SHALL NOT contain colour literals in its rules.
Every colour SHALL be declared once as a custom property named for what
it is for, and referenced from there.

Each such token SHALL also be defined by the layer that maps the shell's
appearance onto a host editor's theme. A token defined in one layer and
not the other renders that host's surface with a missing value.

#### Scenario: Changing the palette

- **WHEN** the palette is changed
- **THEN** it is changed in one place, and no rule keeps an older colour

#### Scenario: The editor-hosted surface

- **WHEN** the shell declares a token
- **THEN** the editor-theme layer defines that same token

### Requirement: Separation is spent by role

Border, fill, radius and shadow each state that something is a separate
object, and SHALL be applied by role rather than uniformly.

Where every block carries the same border, radius and shadow, nothing is
emphasised: a heading, a navigation strip, a panel and a list row all
claim equal importance, and the reader is given no order to read them
in.

Shadow SHALL be reserved for what genuinely sits above the surface.

#### Scenario: A page of mixed blocks

- **WHEN** a page shows a heading, a navigation strip, a panel and a
  list
- **THEN** they are not all drawn as the same object

### Requirement: The shell's own appearance stays out of a host editor

Where the shell is shown inside an editor, its colours SHALL come from
that editor's theme rather than from the shell's own palette.

A tool that repainted its own panel inside somebody's editor would
override a choice that is theirs.

#### Scenario: The same screen in two places

- **WHEN** a screen is shown standalone and inside an editor
- **THEN** the standalone one uses the shell's palette and the hosted
  one follows the editor's theme
