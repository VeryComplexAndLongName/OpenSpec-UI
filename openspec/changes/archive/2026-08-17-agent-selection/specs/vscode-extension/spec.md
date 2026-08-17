## ADDED Requirements

### Requirement: Message-bridge Webview resolves a real agent runner

The default message-bridge Webview mode SHALL resolve `plan`/`implement`/
`review` commands to a real agent runner built from the same
`buildDefaultAgentRunners` registry the standalone delivery uses, instead
of always reporting agent execution as disabled. This is additive to, and
does not replace, the existing native Chat/Agent path
(`openspec-ui.startImplementation`, the `openspec` Chat Participant).

#### Scenario: User runs implement through the AI panel in VS Code

- **WHEN** the user opens the AI panel (message-bridge mode), selects a
  change and an agent, and runs "implement"
- **THEN** the extension host resolves and runs that agent's runner
  directly, the same way the standalone delivery does

#### Scenario: Optional local-server mode also resolves agents

- **WHEN** `openspec.transport.localServer.enabled` is on and the embedded
  standalone shell runs "implement"
- **THEN** the local server it talks to also resolves a real runner,
  consistent with plain standalone
