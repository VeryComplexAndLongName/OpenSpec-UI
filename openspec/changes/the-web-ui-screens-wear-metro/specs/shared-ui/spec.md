## MODIFIED Requirements

### Requirement: Separation is spent by role

Border, fill, radius and shadow each state that something is a separate
object, and SHALL be applied by role rather than uniformly.

Where every block carries the same border, radius and shadow, nothing is
emphasised: a heading, a navigation strip, a panel and a list row all
claim equal importance, and the reader is given no order to read them
in.

Shadow SHALL be reserved for what genuinely sits above the surface.

A block that is a separate object of its own — a named section of a form, a
figure standing beside other figures — MAY be drawn as a card or a panel. A
heading, a navigation strip and a list row SHALL NOT be.

#### Scenario: A page of mixed blocks

- **WHEN** a page shows a heading, a navigation strip, a panel and a
  list
- **THEN** they are not all drawn as the same object

#### Scenario: A named section of a form

- **WHEN** a form is made of named sections
- **THEN** a section may be drawn as a panel with its name in the panel's
  title, and the heading above the form is not drawn as one
