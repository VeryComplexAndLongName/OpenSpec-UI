## ADDED Requirements

### Requirement: Changes and Archive lists share one search implementation

`ChangesList` and `ArchiveList` SHALL both filter their displayed changes
using the same predicate: a case-insensitive match against a change's
name or its human-readable status label. Neither component SHALL
implement its own, independently-maintained filter logic.

#### Scenario: Searching in ChangesList

- **WHEN** a query is entered into `ChangesList`'s search box
- **THEN** only changes whose name or status label matches the query are
  rendered

#### Scenario: Searching in ArchiveList matches status too

- **WHEN** a query matching a status label (not a name) is entered into
  `ArchiveList`'s search box
- **THEN** matching changes are shown, in addition to the existing
  name-match and last-modified sort behavior
