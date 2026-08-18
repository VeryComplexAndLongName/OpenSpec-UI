## ADDED Requirements

### Requirement: Rollback can target an entire Change

The core SHALL offer, alongside per-process rollback, a rollback that
aggregates every finalized checkpoint recorded against a Change name
into a single restore. Each file's restore target SHALL be its content
from the earliest checkpoint that touched it; the conflict check SHALL
compare current file content against each file's latest known post-run
hash. Any conflict SHALL refuse the entire restore, not just the
conflicting file — the same fail-closed, all-or-nothing semantics as
single-process rollback. This capability SHALL be available identically
whether the Change is currently active or already archived.

#### Scenario: Restoring a Change with multiple implement runs

- **WHEN** a Change was implemented across two sequential runs and the
  user requests a Change-level rollback
- **THEN** every file either run touched is restored to its content from
  before the earlier of the two runs

#### Scenario: A file changed outside any known run

- **WHEN** a Change-level rollback is requested and a file's current
  content does not match its latest known post-run hash
- **THEN** the service reports a conflict and restores no files at all

#### Scenario: Rollback for an archived Change

- **WHEN** a Change-level rollback is requested for a Change that has
  since been archived
- **THEN** the restore proceeds identically to an active Change — archive
  status plays no part in eligibility

### Requirement: Opt-in checkpoint retention via extension setting

The VS Code extension SHALL expose a setting controlling automatic
checkpoint/process retention, defaulting to keeping history forever
(unchanged from prior behavior). When configured with a positive number
of days, the extension SHALL prune processes and their checkpoint
sessions older than that cutoff once, at extension activation. Pruning a
process SHALL make both single-process and Change-level rollback
permanently unavailable for it, and this consequence SHALL be disclosed
in the setting's own description.

#### Scenario: Default behavior is unchanged

- **WHEN** the retention setting is left at its default
- **THEN** no process or checkpoint data is ever automatically pruned

#### Scenario: A positive retention period prunes old history

- **WHEN** the setting is configured to a positive number of days and the
  extension activates
- **THEN** processes created before the cutoff, and their checkpoint
  sessions, are removed together
