## ADDED Requirements

### Requirement: Message-bridge Webview annotates the agent picker with detection results

The message-bridge Webview mode SHALL compute agent presence via a direct
core import in the extension host and deliver the result to the Webview
as part of its existing side-channel `context` message, without adding a
new command/event protocol message. Detection SHALL run without delaying
the AI panel becoming visible or usable.

#### Scenario: Panel opens before detection finishes

- **WHEN** the user opens the AI panel
- **THEN** the panel is revealed and usable immediately with `cwd`/
  `changeDir` context as before, and detection results are applied to the
  picker asynchronously once available, without blocking or reloading the
  panel

#### Scenario: Panel is revealed again

- **WHEN** the user re-triggers a command that reveals an already-open AI
  panel
- **THEN** detection runs again and the picker's annotations refresh,
  without a separate manual refresh action needed in this host

#### Scenario: Optional local-server mode

- **WHEN** `openspec.transport.localServer.enabled` is on and the
  embedded standalone shell is used instead of the message bridge
- **THEN** it uses the standalone REST detection endpoint like plain
  standalone, since it is the same browser bundle
