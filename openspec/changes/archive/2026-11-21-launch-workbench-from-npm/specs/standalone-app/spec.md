## MODIFIED Requirements

### Requirement: Standalone shell displays package versions

The server SHALL expose `GET /api/versions`, token-gated the same as every other `/api/` route, returning the `@openspec-ui/core` and `@openspec-ui/server` versions read from each package's own `package.json` or captured from those manifests when an embedded delivery is built. A bundled host SHALL NOT substitute its own package version for Core/server. The standalone browser shell, when booted without the VS Code local-server embed signal, SHALL display a footer showing the core, server and webui versions. Under the VS Code local-server embed signal, the shell SHALL NOT render this footer.

#### Scenario: Plain standalone browser tab shows versions

- **WHEN** a user opens the server's launch URL directly in a browser without the VS Code embed signal
- **THEN** a footer showing core, server and webui versions is rendered

#### Scenario: VS Code local-server embed shows no version footer

- **WHEN** the shell is booted under the VS Code local-server embed signal
- **THEN** no version footer is rendered

#### Scenario: A bundled npm host reports its included versions

- **WHEN** a packed CLI runs the Workbench outside the monorepo
- **THEN** its token-gated version API returns the Core/server versions captured for that build rather than the CLI package version

## ADDED Requirements

### Requirement: Standalone lifecycle reports listen failure and closes browser sockets

A failed listen SHALL reject startup with the original error. Closing the standalone host SHALL disconnect its browser sockets and close the HTTP listener rather than waiting indefinitely for connected clients.

#### Scenario: Another process occupies the selected port

- **WHEN** the server attempts to listen on the occupied local port
- **THEN** startup rejects and the caller can report the failure without an unhandled server error

#### Scenario: A browser is still connected at shutdown

- **WHEN** the host closes with an authenticated WebSocket client connected
- **THEN** the client disconnects and the listener closes
