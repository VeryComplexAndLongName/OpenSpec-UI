## MODIFIED Requirements

### Requirement: A per-change context-menu command shows a change timeline webview

The system SHALL offer a context-menu command, on both active and
archived change tree items, that computes that change's timeline
directly (via a direct `execution-core` import — no HTTP, no message
bridge round trip) and opens it in a webview showing the same view of the
change the standalone Timeline tab shows for one change, under the
change's name. Where the webview is narrow, the view SHALL keep every part
in one column. Opening timelines for different changes SHALL each open in
their own tab, not replace one another.

#### Scenario: User invokes the command on an active change

- **WHEN** the user invokes "Show Change Timeline" on an active change
  tree item
- **THEN** a new webview tab opens showing that change's timeline

#### Scenario: User invokes the command on an archived change

- **WHEN** the user invokes "Show Change Timeline" on an archived change
  tree item
- **THEN** the opened webview includes the change's archived date and
  where it was read from

#### Scenario: User opens timelines for two different changes

- **WHEN** the user invokes the command on two different changes in
  sequence
- **THEN** two separate webview tabs remain open, one per change

#### Scenario: The timeline computation fails

- **WHEN** computing the change's timeline throws
- **THEN** the extension shows an error message and does not open a
  webview
