## MODIFIED Requirements

### Requirement: The standalone shell is marked by the owl

The standalone browser shell SHALL show the project's owl logo at the
left of its headline, 40 CSS pixels square, with an image twice that size
for high-density screens.

The logo SHALL be decorative. It SHALL carry an empty text alternative, so
the headline's accessible name stays "OpenSpec Workbench".

The page SHALL name the owl as its icon.

The shell SHALL fetch neither image from another origin, nor from a path
the server does not already serve.

#### Scenario: The headline shows the owl

- **WHEN** a user opens the server's launch URL in a browser
- **THEN** the owl is shown at the left of the "OpenSpec Workbench" headline, and
  the level-one heading is still named "OpenSpec Workbench"

#### Scenario: The browser tab shows the owl

- **WHEN** the page has loaded
- **THEN** the document names an icon, and that icon is the owl
