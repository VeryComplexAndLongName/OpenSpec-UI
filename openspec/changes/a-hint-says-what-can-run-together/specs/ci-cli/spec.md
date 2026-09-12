## ADDED Requirements

### Requirement: What the repository already knows is offered as a suggestion

Facts the repository computes about which changes can be started
alongside each other SHALL be available as suggestions that name the
action they imply, not only as a report a reader must interpret.

A suggestion SHALL carry the fact it was derived from and the exact
commands that act on it. A suggestion without its reason cannot be
checked and becomes folklore the first time it is wrong; a suggestion
without its commands leaves the reader to translate advice into action,
which is the work it was meant to save.

A suggestion SHALL NOT create, edit, or start anything.

Where several sets of changes could run together, every maximal set
SHALL be named, or — beyond a stated limit — none, with their number
reported. One chosen set presented as the plan would decide for the
reader and hide that a choice existed.

#### Scenario: Two changes that can run side by side

- **WHEN** two ready changes collide over nothing
- **THEN** a suggestion names both, states that their deltas touch no
  capability in common and their branches no file in common, and quotes
  the commands that give each a working directory and start it

#### Scenario: More sets than can usefully be listed

- **WHEN** the number of maximal sets exceeds the stated limit
- **THEN** the suggestion reports how many there are and names none

#### Scenario: Suggestions turned off

- **WHEN** suggestions are turned off
- **THEN** none are computed, and the payload carries no suggestion
  field at all

### Requirement: Suggestions can be asked for from a terminal

The suggestions SHALL be available from the command line, in a form a
person reads and a form a machine parses.

The command SHALL report success whether or not there are any
suggestions: the question was answered either way, and a script asking
"is there anything to do" should read the output rather than infer it
from a failure code — the same contract `ready` and `lease` already
have.

#### Scenario: A workspace with suggestions

- **WHEN** suggestions exist and the command is run
- **THEN** they are printed and the command reports success

#### Scenario: A workspace with none

- **WHEN** no suggestion applies
- **THEN** the command says so in words and reports success

#### Scenario: A workspace whose report cannot be built

- **WHEN** the readiness report cannot be built
- **THEN** the command reports that it could not complete, distinctly
  from having nothing to suggest
