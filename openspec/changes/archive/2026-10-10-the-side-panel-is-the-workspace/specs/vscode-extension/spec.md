## ADDED Requirements

### Requirement: The side panel is the Workspace

The extension's side panel SHALL hold what is about the workspace rather
than one change, and SHALL list its changes as a navigator (ADR 0044). Its
views SHALL be, in this order: Workspace, Human-Only Inbox, Changes, Specs,
Archive, Templates, Processes and Change Graph; Processes and Change Graph
SHALL start folded.

The Workspace view SHALL offer Open Pipeline and Open Dashboard, the
Workspace Harness, which opens the workspace's harness settings, Agents,
OpenSpec Configuration, Repository Setup, and a row for each check the
workspace declares (Run Typecheck, Run Tests, Run Lint).

Agents SHALL list every agent the product knows, each saying whether it is
found on this machine, its version where one was read, and the stages the
workspace harness gives it. The agents SHALL be detected when Agents is
opened, and again only on Refresh Views, since each detection starts their
command-line programs.

The Changes view SHALL list the changes and nothing about the workspace.
Choosing a change SHALL show its card in the Pipeline; its files SHALL be
beneath it. A change worked only in another working directory SHALL have a
row of its own, saying where, which shows its card. A change's row SHALL
offer Show Actions... alone, in its menu and on the row: every action on a
change is on its card, and in that list.

#### Scenario: Opening the side panel

- **WHEN** a person opens the OpenSpec Workbench side panel
- **THEN** Workspace is the first view and Human-Only Inbox the second,
  Processes and Change Graph are folded, and the Changes view has no row for
  the configuration, the setup or the harness

#### Scenario: Choosing a change

- **WHEN** a person chooses a change in the Changes view
- **THEN** the Pipeline opens, or comes to the front, with that change's
  card scrolled into sight, marked for a moment and focused

#### Scenario: A change in its own worktree

- **WHEN** a change is worked only in its own worktree, cut after this
  checkout
- **THEN** the Changes view has a row for it saying which directory it is
  in, and choosing it shows its card

#### Scenario: A change's menu

- **WHEN** a person right-clicks a change in the Changes view
- **THEN** the menu offers Show Actions... alone, and Show Actions... lists
  every action of the change's card

#### Scenario: Which agents are here

- **WHEN** a person opens Agents in the Workspace view, on a machine with
  `claude-cli` 2.1.0 that the harness gives apply and verify, and no
  `codex-cli`
- **THEN** Claude CLI reads "found 2.1.0 - apply, verify" and Codex CLI
  reads "not found"

### Requirement: The Workspace view surfaces repository-setup actions

The Workspace view SHALL show a "Repository Setup" row, always present
regardless of workspace initialization state. Expanding it SHALL list the
repository-bootstrap actions that apply ("Generate Agent Instructions",
"Configure Dependabot", "Generate Path-Scoped Copilot Instructions"), each
running its existing command unchanged, including its project-type
`QuickPick` prompt. Neither the Changes view nor the Archive view SHALL show
this row.

#### Scenario: Repository Setup is in the Workspace view

- **WHEN** the user opens the Workspace view, whether or not any change
  exists
- **THEN** a "Repository Setup" row is shown

#### Scenario: Selecting a repository-setup action runs its command

- **WHEN** the user expands "Repository Setup" and selects "Generate
  Agent Instructions"
- **THEN** the `openspec-ui.generateInstructions` command runs,
  including its existing project-type prompt

## MODIFIED Requirements

### Requirement: Every command is a verb and a noun

Every command the extension contributes SHALL be titled `<Verb> <Noun>`,
with the verb and the noun from the product's lists (ADR 0045), and three
dots after it where the command asks before it acts. Its id SHALL be
`openspec-ui.<verb><Noun>`, its category "OpenSpec Workbench", and its
icon its own. No two commands SHALL share a title or an icon's glyph, and
no command SHALL keep a former id beside its new one.

#### Scenario: A command a person reads

- **WHEN** a person opens a change's Show Actions... list or the command
  palette
- **THEN** every entry reads as a verb and a noun, such as "Configure Change
  Harness" or "Answer Question...", and in the palette it follows "OpenSpec
  Workbench:"

#### Scenario: Icons side by side

- **WHEN** a view's title bar or rows show several commands as icons
- **THEN** each shows a different picture, such as Run Typecheck, Run Tests
  and Run Lint in the Workspace view

#### Scenario: Validation from the palette

- **WHEN** "Validate Change" is run with no change selected
- **THEN** it asks which change, and validates it strictly, as it does from
  a change's Show Actions...

### Requirement: Changes and Archive trees offer whole-Change rollback

A "Rollback Change" action SHALL be available for a Change: in the
"Changes" tree through the change's Show Actions... list, and on an
archived Change's row in the "Archive" tree. Selecting it, when at least
one rollback-eligible process exists for that Change, SHALL show a
confirmation naming the affected file and process counts before
proceeding; when no rollback-eligible process exists, the system SHALL
report that instead of prompting for confirmation.

#### Scenario: Rollback from the Changes tree

- **WHEN** the user chooses "Rollback Change" from an active Change's Show
  Actions... with rollback-eligible processes
- **THEN** a confirmation shows the affected file and process counts
- **AND** confirming restores those files and refreshes the trees

#### Scenario: Rollback from the Archive tree

- **WHEN** the user selects "Rollback Change" on an archived Change with
  rollback-eligible processes
- **THEN** the same confirmation and restore behavior applies, unmodified
  by archive status

#### Scenario: No rollback-eligible processes

- **WHEN** the user selects "Rollback Change" on a Change with no
  rollback-eligible processes
- **THEN** the system reports this without showing a confirmation dialog

## REMOVED Requirements

### Requirement: Changes tree surfaces repository-setup actions

**Reason**: The Changes view lists changes only (ADR 0044). Repository
Setup moves to the Workspace view, with the configuration and the harness.

**Migration**: Open the Workspace view at the top of the side panel; its
Repository Setup row offers the same actions, running the same commands.
