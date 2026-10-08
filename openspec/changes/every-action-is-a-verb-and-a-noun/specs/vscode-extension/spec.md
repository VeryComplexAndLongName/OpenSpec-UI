## ADDED Requirements

### Requirement: Every command is a verb and a noun

Every command the extension contributes SHALL be titled `<Verb> <Noun>`,
with the verb and the noun from the product's lists (ADR 0045), and three
dots after it where the command asks before it acts. Its id SHALL be
`openspec-ui.<verb><Noun>`, its category "OpenSpec Workbench", and its icon
the verb's. No two commands SHALL share a title, and no command SHALL keep
a former id beside its new one.

#### Scenario: A command a person reads

- **WHEN** a person opens a change's context menu or the command palette
- **THEN** every entry reads as a verb and a noun, such as "Configure Change
  Harness" or "Answer Question...", and in the palette it follows "OpenSpec
  Workbench:"

#### Scenario: Validation from the palette

- **WHEN** "Validate Change" is run with no change selected
- **THEN** it asks which change, and validates it strictly, as it does from
  a change's row

## MODIFIED Requirements

### Requirement: Changes tree surfaces repository-setup actions

The "Changes" tree view SHALL show a "Repository Setup" node, always
present regardless of workspace initialization state, positioned
immediately after "OpenSpec Configuration". Expanding it SHALL list the
three repository-bootstrap actions ("Generate Agent Instructions",
"Configure Dependabot", "Generate Path-Scoped Copilot Instructions") as
child items; selecting one SHALL run the corresponding existing command
(`openspec-ui.generateInstructions`,
`openspec-ui.configureDependabot`, `openspec-ui.generateScopedInstructions`)
unchanged, including its project-type `QuickPick` prompt. The "Archive"
tree SHALL NOT show this node.

#### Scenario: Repository Setup node is always visible

- **WHEN** the user opens the "Changes" tree, regardless of whether any
  changes exist
- **THEN** a "Repository Setup" node is shown immediately after "OpenSpec
  Configuration"

#### Scenario: Selecting a repository-setup action runs its command

- **WHEN** the user expands "Repository Setup" and selects "Generate
  Agent Instructions"
- **THEN** the `openspec-ui.generateInstructions` command runs,
  including its existing project-type prompt

#### Scenario: Archive tree has no Repository Setup node

- **WHEN** the user opens the "Archive" tree
- **THEN** no "Repository Setup" node is shown

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

- **WHEN** the user invokes "Show Timeline" on an active change
  tree item
- **THEN** a new webview tab opens showing that change's timeline

#### Scenario: User invokes the command on an archived change

- **WHEN** the user invokes "Show Timeline" on an archived change
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

### Requirement: Cancelling a chain from the Processes tree stops the chain

Cancelling a chain's process from the Processes tree SHALL cancel the chain
itself, identified by the chain's own run id. It SHALL NOT only withdraw the
chain's entry from the scheduler while the chain runs on.

#### Scenario: A running chain

- **WHEN** Stop Process is used on a running chain in the Processes tree
- **THEN** the chain is cancelled, and its agent's process ends

### Requirement: A global command compares every change on a grid of days

The system SHALL offer a Command Palette command, not tied to any single
tree item, that opens a webview comparing every change of the workspace on
a grid whose columns are days — the same screen the standalone shell draws,
with the editor's own colours.

The command SHALL NOT ask which changes to compare. Picking from a list of
every change in the workspace is the work the screen exists to do, and the
editor's answer to "how did this project's changes run" must be the
browser's answer, not a different one.

The webview SHALL be able to ask the extension host for the histories of
the changes it is showing, so its charts rest on the same data the
one-change timeline does, and SHALL state a failed request rather than
leaving the charts blank. A row SHALL open that change's own timeline
panel.

Where reading the workspace fails, the extension SHALL say so and open no
webview.

#### Scenario: Opening the comparison

- **WHEN** the user invokes "Show Comparison"
- **THEN** a webview opens with every active and archived change drawn as a
  bar from proposed to archived, with no selection asked for first

#### Scenario: Opening a change from its row

- **WHEN** the user activates a row in the comparison
- **THEN** that change's own timeline panel opens

#### Scenario: The charts cannot be read

- **WHEN** the webview asks for the histories behind its charts and the
  read fails
- **THEN** the webview says the charts could not be read, and the grid
  stays as it is

#### Scenario: The workspace cannot be read

- **WHEN** reading the workspace's dates throws
- **THEN** the extension shows an error message and does not open a webview
