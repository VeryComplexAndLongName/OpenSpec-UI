## ADDED Requirements

### Requirement: Standalone shell displays package versions

The server SHALL expose `GET /api/versions`, token-gated the same as
every other `/api/` route, returning the `@openspec-ui/core` and
`@openspec-ui/server` package versions read from each package's own
`package.json`. The standalone browser shell, when booted without the VS
Code local-server embed signal (see "Standalone shell restricts tabs
when embedded as the VS Code local-server view"), SHALL display a
footer showing the `core`, `server`, and `webui` versions. When booted
under the VS Code local-server embed signal, the shell SHALL NOT render
this footer.

#### Scenario: Plain standalone browser tab shows versions

- **WHEN** a user opens the server's launch URL directly in a browser (no
  VS Code embed signal present)
- **THEN** a footer showing `core`, `server`, and `webui` version numbers
  is rendered

#### Scenario: VS Code local-server embed shows no version footer

- **WHEN** the shell is booted under the VS Code local-server embed
  signal
- **THEN** no version footer is rendered
