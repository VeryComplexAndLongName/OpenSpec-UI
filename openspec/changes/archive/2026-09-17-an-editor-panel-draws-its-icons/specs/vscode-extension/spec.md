## ADDED Requirements

### Requirement: An editor webview's policy lets the shell's icons draw

Every editor webview that runs a bundle SHALL allow fonts from `data:` in its
Content Security Policy, so that the icon font the shell's stylesheet carries
is loaded. It SHALL NOT allow fonts from any other source.

#### Scenario: A panel with an icon in its title

- **WHEN** the global Harness Settings panel opens in the editor
- **THEN** the gear beside "Global harness settings" is drawn, not an empty
  box

#### Scenario: A new panel

- **WHEN** a webview that runs a bundle is added without allowing `data:`
  fonts
- **THEN** the extension's tests fail and name its source file
