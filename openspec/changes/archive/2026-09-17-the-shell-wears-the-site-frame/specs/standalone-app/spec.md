## ADDED Requirements

### Requirement: The standalone shell wears the project site's frame

The standalone shell SHALL frame every tab as ADR 0033's approved mockup
does: an application bar carrying the product's mark and name, the workspace
path and the theme control; a page head naming the open tab in its one
level-one heading, with a tagline and the sentence that says what the tab is
for; one row of tabs; and a footer carrying the versions.

Each tab SHALL show a short label and SHALL keep its full name as its
accessible name, and the short label SHALL be part of that name.

The frame's colours SHALL come from named tokens, in a light and a dark
palette, and every pair of text and ground it draws SHALL meet WCAG AA.

The VS Code webviews SHALL NOT take the frame, and SHALL keep taking every
colour from the editor's theme.

#### Scenario: A tab is opened

- **WHEN** the user opens any tab of the standalone shell
- **THEN** the page head's level-one heading names that tab, and the tab's
  short label is underlined in the tab row

#### Scenario: A tab found by its name

- **WHEN** assistive technology or a test looks a tab up by its full name,
  such as "OpenSpec view summary"
- **THEN** it finds the tab whose visible label is "Summary"

#### Scenario: Both themes

- **WHEN** the frame is drawn in the light theme and in the dark theme
- **THEN** every text in it meets WCAG AA against the ground it sits on

#### Scenario: VS Code

- **WHEN** a VS Code webview renders a component the shell shares
- **THEN** it shows no application bar, page head or footer, and its colours
  come from the editor's theme
