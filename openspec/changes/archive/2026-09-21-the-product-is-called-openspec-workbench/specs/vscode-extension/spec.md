## MODIFIED Requirements

### Requirement: The extension is marked by the owl

The extension's manifest icon SHALL be the project's owl logo in colour.

The Activity Bar icon of the extension's view container SHALL be a
monochrome owl drawn in `currentColor`. VS Code paints that icon in a
single theme colour, and a colour image would show there as a solid shape.

The message-bridge webview's headline SHALL show the owl as the standalone
shell does, in its own colours. That webview's Content Security Policy
SHALL allow `data:` images, and SHALL NOT allow images from anywhere else.

#### Scenario: The Activity Bar in a dark and a light theme

- **WHEN** the extension is active, in a dark theme and then in a light
  theme
- **THEN** its Activity Bar entry shows an owl outline in that theme's icon
  colour

#### Scenario: The AI panel's headline

- **WHEN** the AI panel opens through the message bridge
- **THEN** the owl is shown at the left of its "OpenSpec Workbench" headline
