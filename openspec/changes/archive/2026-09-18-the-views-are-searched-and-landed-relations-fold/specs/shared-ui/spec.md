## MODIFIED Requirements

### Requirement: Changes and Archive lists share one search implementation

`ChangesList` and `ArchiveList` SHALL both filter their displayed changes
using the same predicate: a case-insensitive match against a change's
name or its human-readable status label. Neither component SHALL
implement its own, independently-maintained filter logic.

That predicate SHALL live in core, and every other list or tree that
narrows rows in either host SHALL use it. A rule that decides what a reader
can find is behaviour, not markup, and a second copy of it in a second host
is a second answer to "does this word match this change".

The predicate SHALL match on every whitespace-separated word of the query
independently, so a reader can narrow by part of a name and part of a state
in one breath.

#### Scenario: Searching in ChangesList

- **WHEN** a query is entered into `ChangesList`'s search box
- **THEN** only changes whose name or status label matches the query are
  rendered

#### Scenario: Searching in ArchiveList matches status too

- **WHEN** a query matching a status label (not a name) is entered into
  `ArchiveList`'s search box
- **THEN** matching changes are shown, in addition to the existing
  name-match and last-modified sort behavior

#### Scenario: One rule in both hosts

- **WHEN** the same words are typed into a list in the standalone shell and
  into a view in the editor
- **THEN** the same changes match, because both ask core the same question

#### Scenario: Two words

- **WHEN** a query holds two words that appear in different parts of a row
- **THEN** the row matches, and a row missing either word does not
