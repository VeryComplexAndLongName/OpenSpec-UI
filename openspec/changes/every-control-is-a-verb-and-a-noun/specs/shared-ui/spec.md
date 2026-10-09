## ADDED Requirements

### Requirement: Every control is a verb and a noun

A web UI button outside a dialog SHALL read as a verb and a noun from ADR
0045's lists, in both hosts, with three full stops where it asks first.
Its accessible name SHALL start with its visible words, without the dots,
and MAY add the change it is about.

A button inside a dialog, or beside a prompt that already names what it is
about, SHALL read as its verb alone: Answer, Allow, Deny, Archive, Delete,
Rollback, Cancel, Close. A switch - a pressed button, a tab, a choice of
view - says what it shows and is not an action.

A button whose verb is a Danger verb (Archive, Rollback, Delete) SHALL ask
before it acts, and SHALL carry the three dots.

A test SHALL read every web UI source for its buttons' words and fail on a
word that is neither a pair from the lists, nor a verb inside a dialog,
nor a switch, nor a state ("Saving...", "Answered").

#### Scenario: A card's buttons

- **WHEN** a person reads a change's card on the Pipeline
- **THEN** its buttons read Show Logs, Run Change..., Stop Run..., Copy
  Path and the like, and none reads "Logs" or "Start..."

#### Scenario: The Pipeline's toolbar

- **WHEN** a person reads the Pipeline's toolbar
- **THEN** it offers Show Tasks or Hide Tasks, Refresh Pipeline, Update
  Main, Show Landed Changes or Hide Landed Changes, and Archive Landed
  Changes...

#### Scenario: Archiving the landed changes asks first

- **WHEN** a person presses Archive Landed Changes...
- **THEN** a dialog named "Archive Landed Changes" opens, nothing is
  archived until its Archive is pressed, and Cancel archives nothing

#### Scenario: Deleting history asks first

- **WHEN** a person presses Delete History... or Rollback Process... in
  Processes
- **THEN** a dialog asks first, and nothing is deleted or rolled back
  until its Delete or Rollback is pressed

#### Scenario: A word that is not a pair

- **WHEN** a component adds a button that reads "Go"
- **THEN** the vocabulary test fails and names the component and the word

## MODIFIED Requirements

### Requirement: A card starts its change through the run dialog

A card whose change can start SHALL offer Run Change. Run Change SHALL open
the run dialog for that change, and SHALL NOT start a run by itself.

A change whose every task is done can start: a run of it continues at
`verify`. Its card SHALL offer Run Change.

A card whose change cannot start SHALL NOT offer Run Change.

#### Scenario: A ready change

- **WHEN** Run Change is used on the card of a ready change
- **THEN** the run dialog opens for that change, and no run starts until a
  path is chosen in it

#### Scenario: A blocked change

- **WHEN** a change is blocked
- **THEN** its card offers no Run Change

#### Scenario: A change whose every task is done

- **WHEN** every task of a change is done, and no run of it is live
- **THEN** its card offers Run Change, and the run dialog it opens says the
  run continues at verify

### Requirement: A run this host started is answered and stopped from its card

Where a change's run was started by the host that shows the card, the card
SHALL:

- say "Waiting for you" while the run waits, and offer to answer it;
- offer Stop Run, and ask for a reason;
- once a stop has been asked, offer Stop Process, which terminates the run.

Where the run was started elsewhere, the card SHALL offer none of these. A
waiting run SHALL be described as answered where it was started. The card
SHALL show the folder the run was started in and offer to copy its path, and
SHALL NOT offer to open that folder.

#### Scenario: A checkpoint on this host's run

- **WHEN** a run this host started waits at a checkpoint
- **THEN** its card says "Waiting for you" and offers Continue Run or Stop
  Run

#### Scenario: Asking a run to stop

- **WHEN** Stop Run is used on a card and a reason is given
- **THEN** the run is asked to stop, the card says it was asked and why, and
  the card offers Stop Process

#### Scenario: A run another host started

- **WHEN** a card's run was started by another host
- **THEN** the card offers no answer and no stop, and offers to copy the
  path of the folder the run was started in

### Requirement: A control that asks before it acts says so

A control SHALL end its visible words with three full stops, "...", where
pressing it asks for something before anything is done: a dialog to choose
in, a name, a pick, a filter, a reason, a confirmation, a file. This holds
for a card's buttons, for the standalone's buttons, and for the editor's
command titles. A control that acts at once, only shows something, or opens
a view SHALL NOT carry them.

The dots SHALL be three full stops, never the single ellipsis character.

A control's accessible name SHALL NOT carry the dots: a card's Run
Change... is named "Run Change" and its change's name.

Every menu in the editor and the operating system follows this convention,
so a person reads a control without dots as acting now; a Start that opened
a dialog instead was reported by a user on 2026-09-24.

#### Scenario: A card's Start

- **WHEN** a card offers Run Change, which opens the run dialog
- **THEN** it reads "Run Change...", and its accessible name is "Run
  Change" and the change's name

#### Scenario: A card's Stop

- **WHEN** a card offers Stop Run, which asks for a reason first
- **THEN** it reads "Stop Run..."; Stop Process, which stops at once, reads
  "Stop Process"

#### Scenario: A command that asks for a name

- **WHEN** the editor contributes Create Change, which asks for a name
- **THEN** its title is "OpenSpec Workbench: Create Change..."

#### Scenario: A command that only shows

- **WHEN** the editor contributes a command that opens a view or shows a
  result
- **THEN** its title carries no dots

### Requirement: The plan can be updated from the panel and the card

The AI panel SHALL offer `update` among its commands, with its purpose,
and, when it is chosen, a field for notes for the update that says it also
reads the change's last completed review. A change's card SHALL offer
**Update Plan** where the change's last run was a review whose verdict was
`changes needed`.

#### Scenario: After a review that asks for changes

- **WHEN** a change's last run was a review with verdict `changes needed`
- **THEN** its card offers **Update Plan**, which opens the panel with
  `update` chosen and a field for notes
