## MODIFIED Requirements

### Requirement: The Changes tree says where each change stands

The Changes tree SHALL show each active change's standing, as
`packages/core` describes it:

- in the item's description, as the standing's word;
- in a file decoration, as a colour that agrees with the word, a one-letter
  badge, and the word as its tooltip.

While the Changes view is visible, the extension SHALL read standings again
on the `openspec/**` watcher's events. It SHALL fetch refs, without touching
any working tree, at most once per fetch interval.

While the Changes view is visible, the extension SHALL also read which runs
are live again whenever a run's status record is written, renewed or
removed. That reading SHALL come from the status records alone: it SHALL NOT
run git, fetch refs or ask `gh`. The runs SHALL be laid over the standings
the tree holds by the same core function a Pipeline card uses, and an item
SHALL be drawn again only where its word, colour or badge changed.

#### Scenario: A change running in another worktree

- **WHEN** a status record says a run in another working directory is on a
  change
- **THEN** that change's item says it is running there, and names the
  directory

#### Scenario: A run starts on a change

- **WHEN** the Changes view is visible, and a run starts on a change and
  writes its status record before it ticks any task
- **THEN** within a few seconds the change's item says Running, with no
  Refresh, and no git command runs for it

#### Scenario: A run ends without touching the change

- **WHEN** a run on a change is stopped before it ticks any task, and its
  status record is removed
- **THEN** within a few seconds the change's item no longer says Running

#### Scenario: A running run renews its record

- **WHEN** a run's status record is rewritten with nothing on it changed but
  its heartbeat
- **THEN** no item is drawn again, and no git command runs

#### Scenario: Refreshing the Changes tree

- **WHEN** the person runs the Changes view's Refresh
- **THEN** the extension reads the files again and fetches refs at once,
  whatever the fetch interval, and every item's standing reflects what was
  fetched

#### Scenario: The colour agrees with a word that is always present

- **WHEN** the theme's colours cannot be told apart by the reader
- **THEN** each item's description and tooltip still state the standing in
  words
