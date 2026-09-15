## MODIFIED Requirements

### Requirement: Every colour the shell draws comes from a named token

The shell's stylesheet SHALL NOT contain colour literals in its rules.
Every colour SHALL be declared once as a custom property named for what
it is for, and referenced from there.

Each such token SHALL also be defined by the layer that maps the shell's
appearance onto a host editor's theme. A token defined in one layer and
not the other renders that host's surface with a missing value.

This includes the variables of the component framework the shell uses.
Every variable its shipped rules read SHALL be set by the editor-theme
layer.

#### Scenario: Changing the palette

- **WHEN** the palette is changed
- **THEN** it is changed in one place, and no rule keeps an older colour

#### Scenario: The editor-hosted surface

- **WHEN** the shell declares a token
- **THEN** the editor-theme layer defines that same token

#### Scenario: A framework variable

- **WHEN** a shipped rule of the component framework reads a variable
- **THEN** the editor-theme layer sets that variable

### Requirement: The shell's own appearance stays out of a host editor

Where the shell is shown inside an editor, its colours SHALL come from
that editor's theme rather than from the shell's own palette.

A tool that repainted its own panel inside somebody's editor would
override a choice that is theirs.

That holds for every theme the editor can have, including dark,
high-contrast and third-party themes. The shell's dark palette SHALL be
selected by the class the editor puts on the page, and no literal colour
SHALL be written for the editor.

#### Scenario: The same screen in two places

- **WHEN** a screen is shown standalone and inside an editor
- **THEN** the standalone one uses the shell's palette and the hosted
  one follows the editor's theme

#### Scenario: A high-contrast theme

- **WHEN** the editor's theme is a high-contrast theme
- **THEN** the hosted screen's controls take their colours and borders
  from that theme

## ADDED Requirements

### Requirement: The standalone shell follows the system theme, and remembers a choice

The standalone shell SHALL draw its dark palette when the system prefers
a dark appearance, and its light palette otherwise, until a person
chooses one with the header's theme toggle.

A choice SHALL be remembered in that browser, and SHALL win over the
system preference until changed. Where the choice cannot be read or
stored, the shell SHALL follow the system preference, and SHALL NOT fail.

Both palettes SHALL meet WCAG AA.

#### Scenario: A system set to dark

- **WHEN** the standalone shell opens with no stored choice, on a system
  that prefers dark
- **THEN** it draws the dark palette

#### Scenario: A remembered choice

- **WHEN** a person chooses light with the toggle, and opens the shell
  again on a system that prefers dark
- **THEN** it draws the light palette

### Requirement: The component framework ships as a scoped copy of a pinned source

The component framework SHALL be vendored in the repository as its
published file, pinned by version and checksum, with its licence.

What ships SHALL be derived from that file by a build step that keeps only
the components the shell uses. That step SHALL scope every rule under the
shell's own root, and SHALL keep no rule on a bare element. The derived
copy SHALL be committed, and a check SHALL fail when it differs from what
the step produces.

Nothing the shell draws SHALL be fetched from another origin.

#### Scenario: A global rule in the framework

- **WHEN** the vendored framework contains a rule on `body`, `html`, `*`
  or another bare element
- **THEN** the shipped copy does not contain it

#### Scenario: A forgotten rebuild

- **WHEN** the vendored file or the kept-component list changes and the
  derived copy is not regenerated
- **THEN** a check fails and names the difference
