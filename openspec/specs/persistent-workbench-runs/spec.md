# persistent-workbench-runs Specification

## Purpose

Define durable Workbench process history, checkpoint recovery, workspace
mutation isolation, rollback coverage disclosure, and package version
ownership shared across delivery targets.
## Requirements
### Requirement: Durable Workbench run journal

The core SHALL persist bounded Workbench process history and checkpoint state
in a versioned workspace-local journal using atomic replacement.

#### Scenario: Completed run survives reload

- **WHEN** a host records and completes a Workbench run
- **AND** the host is restarted
- **THEN** the process remains visible with its terminal state and summary

#### Scenario: Invalid journal is not overwritten

- **WHEN** the persisted journal is corrupt or has an unsupported version
- **THEN** loading fails with an actionable error
- **AND** the existing journal remains unchanged

### Requirement: Interrupted implementation recovery

The Workbench SHALL restore unfinished implementation runs as interrupted and
SHALL NOT silently resume or mark them completed.

#### Scenario: Active implementation is interrupted by reload

- **WHEN** the extension reloads while an implementation checkpoint is active
- **THEN** the process is restored with interrupted state
- **AND** its current workspace delta is finalized for explicit review or
  rollback

### Requirement: Workspace mutation isolation

The Workbench SHALL run at most one mutating process in a workspace at a
time until mutations have independent filesystem isolation, whether both
attempts originate in the same host process or in two different host
processes (for example, a VS Code extension host and a standalone
server) pointed at the same workspace root. Cross-process isolation
SHALL be enforced by a versioned, workspace-local lease file that the
running host renews while a mutating process is active and releases
when that process reaches a terminal state; a lease whose last renewal
is older than a bounded staleness window SHALL be treated as no longer
held. Read-only runs SHALL remain unaffected by the lease.

#### Scenario: Different changes mutate the same workspace

- **WHEN** mutating runs for two different changes are requested
- **THEN** the second run remains queued until the first reaches a terminal
  state
- **AND** read-only runs may execute concurrently

#### Scenario: A second host attempts to mutate the same workspace

- **WHEN** a mutating run is requested on a host that does not hold the
  current workspace lease, and that lease is not stale
- **THEN** the run fails immediately, reporting which other host
  currently holds the lease
- **AND** no process record is left queued waiting for the other host to
  finish

#### Scenario: The lease holder releases on completion

- **WHEN** a mutating run reaches a terminal state
- **THEN** its host releases the workspace lease
- **AND** a subsequent mutating run, from either host, may acquire it
  immediately

#### Scenario: The previous lease holder is no longer active

- **WHEN** a host requests a mutating run and the existing lease's last
  renewal is older than the staleness window
- **THEN** the host acquires the lease and proceeds
- **AND** the reclamation is disclosed rather than silently overwritten

### Requirement: Checkpoint coverage disclosure

A checkpoint SHALL report files and directory classes omitted from rollback
coverage.

#### Scenario: Oversized file is skipped

- **WHEN** a file exceeds the configured per-file checkpoint limit
- **THEN** its relative path is recorded in checkpoint coverage
- **AND** a host can disclose that rollback coverage is partial

### Requirement: Package-level version ownership

Release documentation SHALL treat package versions as authoritative and SHALL
bump only packages whose shipped behavior changes according to SemVer.

#### Scenario: Core and extension gain persistence

- **WHEN** persistent Workbench runs ship in core and VS Code
- **THEN** core and extension receive compatible minor version bumps
- **AND** unchanged server and webui package versions remain unchanged

### Requirement: Recovery behavior is transport-neutral

The system SHALL expose process history, checkpoint details, conflict-safe
rollback, and retention cleanup through a core service reusable by every
delivery target.

#### Scenario: A host starts after an unfinished run

- **WHEN** the recovery service loads a journal containing a queued or running process
- **THEN** it marks the process interrupted, finalizes its checkpoint for review, and persists the recovered state

#### Scenario: Files changed after checkpoint finalization

- **WHEN** a user requests rollback and current files do not match the finalized checkpoint
- **THEN** the service reports conflicts and does not partially restore files

### Requirement: Run retention removes matching checkpoint data

The system SHALL remove checkpoint sessions whenever their retained process is
removed so journals contain no orphaned recovery data.

#### Scenario: User cleans old history

- **WHEN** processes older than the requested cutoff are removed
- **THEN** their checkpoint sessions are removed in the same journal update

### Requirement: Run recovery fails closed for incompatible persisted formats
The system SHALL reject unsupported journal and checkpoint versions without
moving, rewriting, or deleting the persisted journal.

#### Scenario: Older delivery opens a future journal version
- **WHEN** the persisted journal version is newer than the bundled core supports
- **THEN** recovery fails with an upgrade-required diagnostic
- **AND** the journal remains byte-for-byte unchanged at its original path

#### Scenario: Journal contains a future checkpoint version
- **WHEN** the journal version is supported but a checkpoint version is not
- **THEN** recovery fails with a checkpoint compatibility diagnostic
- **AND** the journal remains byte-for-byte unchanged

#### Scenario: Journal JSON is malformed
- **WHEN** the journal cannot be parsed as JSON
- **THEN** recovery fails with a corruption diagnostic distinct from version compatibility

#### Scenario: Host presents a recovery failure
- **WHEN** core rejects persisted recovery state
- **THEN** the host displays the actionable core diagnostic
- **AND** does not infer compatibility by parsing human-readable error text

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

### Requirement: Checkpoint persistence excludes sensitive and generated state

The workbench SHALL omit sensitive environment files, generated caches, and
local virtual environments from checkpoint capture and rollback data.

#### Scenario: Capture a workspace containing generated local state

- **WHEN** a checkpoint is captured for a workspace containing `.env`, a local
  virtual environment, or a supported generated cache directory
- **THEN** those paths are not read into the checkpoint
- **AND** ordinary workspace files remain covered by rollback

#### Scenario: Restore a historical checkpoint

- **WHEN** a version-1 run journal contains paths that are excluded by the
  current checkpoint policy
- **THEN** recovery removes those paths from the checkpoint snapshots and delta
- **AND** the sanitized journal is persisted without deleting workspace files

#### Scenario: Capture a Git workspace with project-specific ignores

- **WHEN** a checkpoint is captured in a Git workspace with root or nested
  `.gitignore` rules
- **THEN** untracked paths ignored by Git are omitted from the checkpoint
- **AND** negated untracked paths and tracked files remain covered

#### Scenario: Capture a workspace outside Git

- **WHEN** Git cannot enumerate files for the workspace
- **THEN** checkpoint capture falls back to filesystem traversal
- **AND** mandatory sensitive and generated-state exclusions still apply

### Requirement: Terminal agent-run state triggers a host notification

For `plan`/`implement`/`review` runs specifically -- not the deterministic
`status`/`list`/`show`/`validate` commands -- each delivery target SHALL
notify the user through its host's own native notification mechanism when
the run reaches a `completed` or `failed` terminal state, so a user who is
not actively watching the Processes view or the AI panel still learns the
run finished. `cancelled`, `interrupted`, and `rolled-back` terminal
states SHALL NOT trigger a notification.

#### Scenario: An agent run completes while the user is not watching

- **WHEN** a `plan`/`implement`/`review` run reaches the `completed` state
- **THEN** the host shows a notification identifying the operation, the
  change, and its summary

#### Scenario: An agent run fails

- **WHEN** a `plan`/`implement`/`review` run reaches the `failed` state
- **THEN** the host shows a notification identifying the operation, the
  change, and the failure reason

#### Scenario: Deterministic commands do not notify

- **WHEN** a `status`/`list`/`show`/`validate` run reaches a terminal
  state
- **THEN** no notification is shown

#### Scenario: Cancellation, interruption, and rollback do not notify

- **WHEN** a run is cancelled, restored as interrupted, or rolled back
- **THEN** no notification is shown

#### Scenario: A restored run from a prior session does not re-notify

- **WHEN** a host activates and loads process history that was already in
  a terminal state before this activation
- **THEN** no notification is shown for any of those already-terminal
  processes

### Requirement: A process may wait on an external signal without holding the workspace mutation lock

A running process SHALL be able to suspend itself while it waits for a
signal from outside the workspace. While suspended it SHALL NOT hold the
workspace mutation lock, and the system SHALL admit other mutating work in
its place.

A suspended process SHALL record what it is waiting for.

Resuming a suspended process SHALL return it to the queue rather than
returning it directly to running, so that no two processes may hold the
mutation lock at once.

#### Scenario: Other work proceeds while a process waits

- **WHEN** a mutating process suspends to wait for an external signal
- **THEN** another mutating process may start and finish while it waits

#### Scenario: A suspended process is resumed

- **WHEN** a suspended process receives the signal it was waiting for
- **THEN** it returns to the queue and runs again once the mutation lock
  is available

#### Scenario: Two processes suspended at once

- **WHEN** two suspended processes are resumed together
- **THEN** they run one after another, never concurrently

#### Scenario: A suspended process is cancelled

- **WHEN** a suspended process is cancelled
- **THEN** it ends as cancelled without waiting for its signal

### Requirement: Every suspension is bounded and reported when it expires

A suspension SHALL have a maximum duration. When it elapses without the
signal arriving, the process SHALL fail, and the failure SHALL name what
the process was waiting for.

#### Scenario: The signal never arrives

- **WHEN** a suspension's maximum duration elapses before its signal
- **THEN** the process fails with a reason naming what it awaited, and the
  mutation lock is available to the next queued process

### Requirement: Cross-host exclusion follows the suspension

Where the system holds a cross-host claim on the workspace for a mutating
process, suspending that process SHALL release the claim, and resuming it
SHALL require the claim to be reacquired before it runs again.

A resumed process that cannot reacquire the claim SHALL wait rather than
proceed without it.

#### Scenario: Another host may work while a process waits

- **WHEN** a mutating process holding the cross-host claim suspends
- **THEN** the claim is released

#### Scenario: The claim is unavailable at resume

- **WHEN** a resumed process cannot reacquire the cross-host claim
- **THEN** it waits in the queue and does not run

### Requirement: A suspension does not survive a host restart

When the system loads persisted process history, a process recorded as
suspended SHALL be reported as interrupted, with a reason stating that the
host awaiting its signal is gone.

#### Scenario: Restart with a suspended process on record

- **WHEN** process history containing a suspended process is loaded
- **THEN** that process is reported as interrupted, and is not awaiting
  any signal

### Requirement: A waiting process is presented as waiting

A suspended process SHALL be presented distinctly from a running one,
together with what it is waiting for, and SHALL NOT be counted as making
progress.

#### Scenario: A suspended process in the process list

- **WHEN** a suspended process is shown
- **THEN** it is shown as waiting, with what it awaits, and not as running

### Requirement: Restoring runs does not read what it does not need

Restoring persisted runs at startup SHALL read what is needed to list
them, and SHALL NOT read the captured content of a checkpoint that
nothing has asked for.

The cost of restoring SHALL NOT grow with the number of checkpoints
retained on disk.

A checkpoint's content SHALL be read when a rollback or a delta is
requested for it, and a failure to read it then SHALL be reported where
the request was made.

#### Scenario: Startup with many retained checkpoints

- **WHEN** runs are restored and many retained checkpoints exist on disk
- **THEN** their captured content is not read, and restoring costs the
  same as it would with none

#### Scenario: A rollback is requested

- **WHEN** a rollback is requested for a retained run
- **THEN** that checkpoint's content is read at that moment, and the
  rollback produces the same result as before this requirement

#### Scenario: An interrupted run needs its delta

- **WHEN** a restored run was interrupted and has no reviewable delta yet
- **THEN** its checkpoint is resolved during restore, because that is
  what makes the run reviewable

### Requirement: Retained checkpoints are bounded on their own terms

The number of retained checkpoints SHALL be bounded by its own limit,
separate from the limit on retained run history.

Retention SHALL be decided by recency, and SHALL NOT be decided by a
run's final state: a run that finished is still one the system offers to
roll back.

A checkpoint outside the bound SHALL have its stored content deleted, and
a run whose content has been deleted SHALL still list without error.

#### Scenario: More checkpoints than the bound

- **WHEN** more checkpoints exist than the bound allows
- **THEN** the most recent are kept, the rest have their content deleted,
  and every run still lists

#### Scenario: A finished run inside the bound

- **WHEN** a run that completed successfully is inside the retention
  bound
- **THEN** its checkpoint is kept and its rollback still works

#### Scenario: A run whose content was evicted

- **WHEN** a run's checkpoint content has been deleted by retention
- **THEN** the run still appears in the run history, and no rollback is
  offered for it

