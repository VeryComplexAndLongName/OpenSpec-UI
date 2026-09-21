## ADDED Requirements

### Requirement: The Changes tree says whose each change is

The Changes tree SHALL draw this working directory's own change first, and
the view's description SHALL name that change.

For each change that is worked in another working directory, the tree
SHALL draw a locked, greyed icon and SHALL say in the item's description
which directory it is worked in and, where a verified record names one,
which person. The whole sentence SHALL also be the item's tooltip. A change
no directory has taken up SHALL keep its standing's icon, colour and menu.

The per-change commands that write SHALL be hidden on an item worked in
another working directory, and each of those commands SHALL refuse when it
is invoked by name, naming the working directory to work in instead.

Where this checkout has no change of its own, the view SHALL say so and
SHALL say how many changes are being worked in other working directories,
with a press that opens the Pipeline.

These readings SHALL come from the survey the tree already takes: no
additional watcher, and no additional git invocation.

#### Scenario: A fresh working directory holds somebody else's changes

- **WHEN** a directory is cut from the default branch while other changes
  are active there
- **THEN** its own change is first and named in the view's description,
  and the others are drawn locked, naming the directories they are worked
  in

#### Scenario: A writing command reached another way

- **WHEN** a command that would write to a change is invoked from the
  palette while that change is worked in another working directory
- **THEN** it refuses, names that directory, and writes nothing

#### Scenario: The main checkout while the work is elsewhere

- **WHEN** the main working directory has no change of its own and four
  are worked in other directories
- **THEN** the view says so, says how many, and offers to open the
  Pipeline

### Requirement: Another working directory's change can be read without writing

The extension SHALL open another working directory's `proposal.md`,
`design.md` and `tasks.md` as documents that cannot be saved, serving their
text through a provider on a scheme of its own rather than opening the
files themselves. The editor's title SHALL name the change, the directory
and that it is read-only.

A file that is absent, or a directory that cannot be read, SHALL open as a
one-line explanation rather than an error notification.

The extension SHALL also offer to open that working directory itself.

#### Scenario: Reading what the other agent has written

- **WHEN** another directory's copy of a change has edits that are not
  committed
- **THEN** opening it here shows those edits, and the document cannot be
  saved

### Requirement: A picker moves between every active change

The extension SHALL offer a command that lists every active change with
where it is worked and whose it is, and reveals the chosen change in the
Changes tree. This working directory's own change SHALL be first in that
list.

#### Scenario: Choosing a change from the picker

- **WHEN** the picker is opened in a working directory with an own change
- **THEN** that change is the first entry, and choosing any entry reveals
  it in the tree
