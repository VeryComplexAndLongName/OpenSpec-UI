## ADDED Requirements

### Requirement: Optional local-server embed signals its context to the standalone shell

When the optional local-server Webview mode is active, the extension SHALL
mark the iframe URL it builds for the standalone shell with a signal
identifying it as the VS Code local-server embed, distinct from a plain
standalone browser session. The extension SHALL NOT rely on the standalone
shell rendering its full section set inside this embed; native VS Code UI
(diff editor, tree views, native file editing) remains the source of truth
for the areas the embed does not show.

#### Scenario: Local-server mode webview panel is created

- **WHEN** `AiPanel` builds the iframe HTML for the optional local-server
  mode
- **THEN** the iframe `src` includes the embed signal identifying it as the
  VS Code local-server embed

#### Scenario: Direct-core message-bridge mode is unaffected

- **WHEN** the extension runs in its default message-bridge mode (no local
  server)
- **THEN** no embed signal is relevant, since this mode does not load the
  standalone shell at all
