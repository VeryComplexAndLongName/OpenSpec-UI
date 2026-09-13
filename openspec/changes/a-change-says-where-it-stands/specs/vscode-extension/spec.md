## ADDED Requirements

### Requirement: The Changes tree says where each change stands

The Changes tree SHALL show each active change's standing, as
`packages/core` describes it:

- in the item's description, as the standing's word;
- in a file decoration, as a colour that agrees with the word, a one-letter
  badge, and the word as its tooltip.

While the Changes view is visible, the extension SHALL read standings again
on the `openspec/**` watcher's events. It SHALL fetch refs, without touching
any working tree, at most once per fetch interval.

#### Scenario: A change running in another worktree

- **WHEN** a status record says a run in another working directory is on a
  change
- **THEN** that change's item says it is running there, and names the
  directory

#### Scenario: Refreshing the Changes tree

- **WHEN** the person runs the Changes view's Refresh
- **THEN** the extension reads the files again and fetches refs at once,
  whatever the fetch interval, and every item's standing reflects what was
  fetched

#### Scenario: The colour agrees with a word that is always present

- **WHEN** the theme's colours cannot be told apart by the reader
- **THEN** each item's description and tooltip still state the standing in
  words
