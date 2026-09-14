## ADDED Requirements

### Requirement: A change's list entry says where the change stands

The Changes list SHALL show, for each change, one word that says where the
change stands across the repository, derived in `packages/core` from:

- this checkout's copy;
- every working directory's copy;
- the repository's main branch;
- the change's own branch;
- where it can be read, the branch's pull request.

The word SHALL come from the one closed set of state words that every
surface uses:

- Running, or running in a named directory;
- Waiting for you, or waiting in a named directory;
- Archived on main;
- Merged in a numbered pull request;
- Deleted on main;
- Further along in a named directory or on a named branch;
- Failed at a stage;
- Stopped at a stage;
- Done;
- Blocked;
- Ready.

The first word that applies, in that order, SHALL be shown. Whatever else
applies SHALL be stated in lines beneath it, each naming its source.

A colour SHALL agree with the word, and SHALL NOT be the only way the state
is shown.

The list SHALL state which ref was read as the main branch, when the
repository's refs were last fetched, and whether the last fetch or the
pull request reading failed.

#### Scenario: A change archived on main

- **WHEN** a change is active in this checkout and archived on the main
  branch
- **THEN** its entry says "Archived on main", with a colour that agrees

#### Scenario: A change further along elsewhere

- **WHEN** another working directory's copy of a change has more tasks done
  than this checkout's copy
- **THEN** the entry says the change is further along there, and gives both
  counts and that directory's label

#### Scenario: Refs that could not be refreshed

- **WHEN** the last fetch failed
- **THEN** the list says so and when refs were last fetched, and still shows
  every standing it could read

### Requirement: Every surface shows a change the same way

The Changes list, the VS Code Changes tree, a Pipeline card and the
terminal SHALL show the same state word, the same lines and the same colour
role for a change. They SHALL obtain them from one function in
`packages/core`, and none of them SHALL derive a change's state itself.

#### Scenario: One change on two surfaces

- **WHEN** a change is archived on the main branch and ready in this
  checkout
- **THEN** the Changes list and the change's card both say "Archived on
  main", with "Ready" as a line beneath it, in the same colour role

### Requirement: A person can refresh a change's state now

The Changes list and the Pipeline SHALL offer a Refresh control. It SHALL
read every change's files again and fetch the repository's refs at once,
and then state when refs were last fetched.

While a fetch is under way the control SHALL say so and SHALL NOT start a
second one. A failed fetch SHALL be stated beside it.

#### Scenario: A pull request merged a moment ago

- **WHEN** a change's pull request was merged after the last fetch, and the
  person presses Refresh
- **THEN** the change's word becomes "Merged" and the line saying when refs
  were last fetched shows the new time

#### Scenario: Refresh pressed twice

- **WHEN** the person presses Refresh again while its fetch is under way
- **THEN** no second fetch starts

### Requirement: The run dialog asks before starting a change that stands elsewhere

The run dialog SHALL lead with the change's standing, read after a fresh
fetch. Where the change is running elsewhere, archived on the main branch,
merged, or deleted on the main branch, every path SHALL stay disabled until
the person confirms that they want to start it anyway.

The dialog SHALL NOT refuse the run.

#### Scenario: Starting a change archived on main

- **WHEN** a person opens the run dialog for a change archived on the main
  branch
- **THEN** the dialog says so first, and no path can start until the person
  confirms

#### Scenario: Starting a change only here

- **WHEN** a person opens the run dialog for a change no other source has
- **THEN** the dialog starts it as before, with no confirmation
