## ADDED Requirements

### Requirement: The public npm package launches the standalone Workbench

The public CLI SHALL offer `open workbench` using the existing standalone host with prebuilt shared UI assets, without cloning or building OpenSpec-UI at launch. It SHALL accept an existing cwd and local port, bind to 127.0.0.1, preserve token/Origin/workspace authorization and print an authenticated launch URL. Existing CLI commands SHALL retain their behavior and SHALL NOT start the server. The launcher SHALL NOT install or launch agents or bypass configured permissions.

#### Scenario: Launch from an isolated production-only npm install

- **WHEN** the installed package launches for a project outside this monorepo
- **THEN** the shell, browser chunks and authenticated API are served from the package with the actual included package versions
- **AND** no private workspace dependency or source build is required

#### Scenario: Input or local port prevents startup

- **WHEN** cwd or port is invalid or the requested port is occupied
- **THEN** the command reports the startup error and exits 2 without silently choosing an external bind or leaving a usable host running

#### Scenario: The terminal stops the host after active agent work has ended

- **WHEN** no agent run is active and the launcher receives an orderly stop signal
- **THEN** it closes the local HTTP and browser socket server and exits 0
