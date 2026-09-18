## MODIFIED Requirements

### Requirement: The standalone shell follows the system theme, and remembers a choice

The standalone shell SHALL draw its dark palette when the system prefers
a dark appearance, and its light palette otherwise, until a person
chooses one with the header's theme control.

A choice SHALL be remembered in that browser, and SHALL win over the
system preference until changed. Where the choice cannot be read or
stored, the shell SHALL follow the system preference, and SHALL NOT fail.

Both palettes SHALL meet WCAG AA.

The control SHALL state its two states in its own role rather than by
renaming itself: its accessible name SHALL NOT change with the theme, and the
state SHALL be carried both by that role and by something a person can see
without words. It SHALL show no text label beside itself.

#### Scenario: A system set to dark

- **WHEN** the standalone shell opens with no stored choice, on a system
  that prefers dark
- **THEN** it draws the dark palette

#### Scenario: A remembered choice

- **WHEN** a person chooses light with the toggle, and opens the shell
  again on a system that prefers dark
- **THEN** it draws the light palette

#### Scenario: The control in either state

- **WHEN** the theme is light and again when it is dark
- **THEN** the control's accessible name is the same in both, and its state
  is announced by its role and shown by a glyph, with no words beside it
