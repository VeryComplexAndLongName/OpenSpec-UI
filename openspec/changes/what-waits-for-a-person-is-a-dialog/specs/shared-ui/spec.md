## ADDED Requirements

### Requirement: What waits for a person is a modal dialog

A form that waits for a person's decision - the answer to an agent's
questions, the reason for a Stop, the confirmation of a Danger action, a
change's action and its run dialog in the standalone app - SHALL be drawn
as a modal dialog over the whole view (ADR 0047), and so SHALL what a
person asked to see from a card: a run's logs and a task shown whole. The
view behind it SHALL be dimmed and SHALL NOT take a press. Focus SHALL move
into the dialog, SHALL stay in it as Tab moves, and SHALL return to the
control that opened it when it closes. It SHALL close by its own answer or
Cancel, or by Escape, and SHALL NOT close by a press beside it. It SHALL be
named by the change and what is wanted, and SHALL carry `aria-modal`.

#### Scenario: Answering from a card

- **WHEN** a person presses Answer on a card whose agent asked two questions
- **THEN** a dialog named "Answer <change>" stands over the Pipeline, its
  first field has the focus, and nothing behind it can be pressed until it
  is answered, cancelled or closed with Escape

#### Scenario: Tab at the last control

- **WHEN** the focus is on a dialog's last control and Tab is pressed
- **THEN** the focus moves to the dialog's first control, not to the view
  behind it

### Requirement: The Pipeline says at its top what waits for a person

Every question an agent put and every permission request a run this host
holds waits on SHALL be said at the top of the Pipeline, above the
picture, and SHALL stay in sight as the picture scrolls, whatever the
number of changes (ADR 0047). Each SHALL name its change. A question's
Answer SHALL open the same dialog the card's Answer opens; a permission
SHALL be allowed or denied there as on the card. An agent's question SHALL
NOT open a dialog by itself. Nothing SHALL be said there while nothing
waits.

#### Scenario: A question among many changes

- **WHEN** an agent of one of thirty changes asks a question
- **THEN** the top of the Pipeline says that change asks a question, with
  Answer, without scrolling

#### Scenario: Nothing waits

- **WHEN** no question and no permission request is open
- **THEN** nothing is said at the top of the Pipeline

### Requirement: A run's panel puts what it waits for first

A run's panel - the run panel and the chain panel - SHALL draw the
permission requests and the questions its run waits on first, before its
controls and its output, and SHALL keep them in sight as the output grows
(ADR 0047). Nothing SHALL be drawn there while nothing waits.

#### Scenario: A question during a chain

- **WHEN** a chain's agent asks a question while the chain's output scrolls
- **THEN** the question and its Answer stand at the top of the chain's
  panel

## MODIFIED Requirements

### Requirement: A card's task is shown whole

A card's task row SHALL carry the task's whole text and what is written
under it in `tasks.md`. Hovering the row SHALL show all of it, and
selecting the row, by pointer or keyboard, SHALL show it whole in a dialog
over the board (ADR 0047), on a card read from any directory. A card's
height is derived from what it lists, so a task is not opened inside the
card.

#### Scenario: A wrapped task with a record

- **WHEN** a task's sentence wraps onto two more lines and a record is
  written under it
- **THEN** the row's hint holds all of it, and selecting the row shows it
  whole in a dialog over the board
