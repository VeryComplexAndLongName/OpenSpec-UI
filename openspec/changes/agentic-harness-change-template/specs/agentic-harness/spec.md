## ADDED Requirements

### Requirement: "Create Change Template" creates a change and optionally configures its harness override in one flow

The VS Code extension SHALL offer a command that creates an OpenSpec
change and then offers to configure that change's per-change Agentic
Harness override (`openspec/changes/<id>/harness.json`) as part of the
same flow, without requiring a separate "configure harness" action
afterward. Declining customization, or answering every question with
"(inherit from global default)", SHALL leave no per-change override file
— identical to a change created without ever running this command.

#### Scenario: Change created without harness customization

- **WHEN** the command is invoked, a change id is entered, and "Use
  global Agentic Harness defaults" is chosen
- **THEN** the change is created and no per-change `harness.json` is
  written

#### Scenario: Change created with an explicit harness customization

- **WHEN** the command is invoked, a change id is entered, "Customize for
  this change" is chosen, and at least one stage/autonomyLevel/
  reviewGate.mode answer is not "(inherit)"/left at default
- **THEN** the change is created and a per-change `harness.json`
  reflecting only the explicitly chosen fields is written

#### Scenario: Cancelling mid-wizard discards the customization, not the change

- **WHEN** the wizard is cancelled (Esc) at any customization question
  after the change has already been created
- **THEN** the change remains created, and no per-change `harness.json`
  is written — answers collected before the cancellation are discarded,
  not partially persisted

#### Scenario: An all-"(inherit)" customization pass writes nothing

- **WHEN** "Customize for this change" is chosen but every question is
  answered "(inherit from global default)"/left at its default
- **THEN** no per-change `harness.json` is written, the same outcome as
  declining customization entirely
