## ADDED Requirements

### Requirement: A control that asks before it acts says so

A control SHALL end its visible words with three full stops, "...", where
pressing it asks for something before anything is done: a dialog to choose
in, a name, a pick, a filter, a reason, a file. This holds for a card's
buttons, for the standalone's buttons, and for the editor's command titles.
A control that acts at once, only shows something, opens a view, or asks
to confirm what was already chosen SHALL NOT carry them.

The dots SHALL be three full stops, never the single ellipsis character.

A control's accessible name SHALL NOT change with this: a card's Start is
still named "Start" and its change's name.

Every menu in the editor and the operating system follows this convention,
so a person reads "Start" as starting now; a Start that opens a dialog
instead was reported by a user on 2026-09-24.

#### Scenario: A card's Start

- **WHEN** a card offers Start, which opens the run dialog
- **THEN** it reads "Start...", and its accessible name is "Start" and the
  change's name

#### Scenario: A card's Stop

- **WHEN** a card offers Stop, which asks for a reason first
- **THEN** it reads "Stop..."; Stop now, which stops at once, reads "Stop now"

#### Scenario: A command that asks for a name

- **WHEN** the editor contributes Create Change, which asks for a name
- **THEN** its title is "OpenSpec Workbench: Create Change..."

#### Scenario: A command that only shows

- **WHEN** the editor contributes a command that opens a view or shows a
  result
- **THEN** its title carries no dots
