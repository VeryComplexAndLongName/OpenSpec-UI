# repository-compliance Specification

## Purpose
TBD - created by archiving change workbench-compliance-monitor. Update Purpose after archive.

## Requirements

### Requirement: Compliance rules are explicit, sourced and non-executable

Core SHALL expose a versioned catalogue of stable rule ids. Each rule SHALL
identify the requirement source, check outcome semantics, default reaction,
conservative cost class and whether a core-owned repair exists. Repository file contents
SHALL be treated as data and SHALL NOT register executable checks or repairs.
Insufficient evidence SHALL produce `unknown`, not a passing result.

#### Scenario: A requirement can be checked mechanically

- **WHEN** the catalogue includes a supported evaluator for a sourced rule
- **THEN** its result names the stable rule id, source and measured evidence

#### Scenario: A requirement cannot be checked mechanically

- **WHEN** no evaluator has enough evidence to decide compliance
- **THEN** the result is `unknown` or advice, never an inferred pass

#### Scenario: Repository data names an unknown rule

- **WHEN** a repository file names an id absent from the catalogue
- **THEN** no code from that file is executed and the rule is reported as unsupported

### Requirement: Repository initialization verifies managed runtime ignores

When Workbench initializes a repository, core SHALL verify that its local
`.openspec-ui/` runtime state is ignored by Git. If it is not, core SHALL add
only the required root ignore pattern, preserving existing entries, ordering,
line endings and unrelated content. If the file cannot be safely changed, the
initialization result SHALL explain the issue and offer advice without
overwriting the file.

#### Scenario: The runtime directory is not ignored

- **WHEN** initialization finds that `.openspec-ui/` is not ignored
- **THEN** it adds the managed root rule and verifies that Git ignores the path

#### Scenario: An equivalent ignore rule already exists

- **WHEN** Git already ignores `.openspec-ui/` through an existing rule
- **THEN** initialization leaves `.gitignore` unchanged

#### Scenario: Existing ignore content is foreign or unreadable

- **WHEN** core cannot safely add the rule
- **THEN** it preserves the file and reports an actionable finding

#### Scenario: Runtime state is visible as untracked files in main

- **WHEN** `.openspec-ui/` contains a run journal, audit/run log, lease or
	temporary lease file that Git reports as untracked
- **THEN** compliance identifies the missing ignore rule and affected paths
- **AND** it leaves all existing runtime data untouched

#### Scenario: Runtime state is outside its expected artifact root

- **WHEN** an artifact's observed root disagrees with that artifact kind's
	declared root contract
- **THEN** compliance reports its path and recorded `cwd`/`changeDir` where available
- **AND** it does not move, rewrite or delete the artifact

### Requirement: Change identity is deduplicated across worktrees

Compliance SHALL identify a logical change by its stable id, not by the number
of worktree directories containing it. Copies of the same active change in
multiple worktrees SHALL be grouped, not reported as duplicate proposals. An id
present in both active and archive directories SHALL be reported with both
paths. An untracked main-checkout change artifact beside its owning worktree
SHALL be reported as a possible shadow copy. These findings SHALL default to
advice and SHALL NOT delete, move or archive files. Compliance SHALL group
logical ids without rewriting the Pipeline's existing directory cards.
Active change ids SHALL be checked against a declared OpenSpec README index; a missing
entry SHALL produce a suggested link, not an automatic README edit. A worktree
whose change is closed or archived in the repository SHALL be reported as
possibly stale with its branch/base relationship and dirty paths when
available; it SHALL NOT be removed automatically.

#### Scenario: One active change appears in multiple worktrees

- **WHEN** the same stable id is found in main and one or more worktrees
- **THEN** compliance returns one logical change with all observed paths
- **AND** it does not recommend removing a worktree merely because the id repeats

#### Scenario: The same id appears in active and archive trees

- **WHEN** a stable id exists under both `openspec/changes/` and
	`openspec/changes/archive/`
- **THEN** compliance reports both paths and recommends review
- **AND** it does not remove either directory

#### Scenario: Main contains an untracked shadow copy

- **WHEN** main has untracked change artifacts while a worktree owns the same id
- **THEN** compliance identifies both roots and preserves all artifact contents

#### Scenario: An active change is missing from the README index

- **WHEN** an active change id has no link in the OpenSpec README index
- **THEN** compliance reports the missing entry and a suggested link target
- **AND** it does not edit the README

#### Scenario: Pipeline and Changes represent different numbers of changes

- **WHEN** Pipeline cards and Changes entries are derived from the same
	repository snapshot
- **THEN** Compliance distinguishes logical change identities from physical copies
- **AND** it leaves existing Pipeline directory cards unchanged

#### Scenario: A worktree holds a closed or archived change

- **WHEN** a registered worktree contains a change already closed or archived
	in the repository
- **THEN** compliance reports the branch, relationship to the current base and
	dirty paths when available
- **AND** it preserves the worktree and all uncommitted content

### Requirement: Reactions are configurable and repairs are allowlisted

The monitor SHALL support global enablement and a per-rule reaction of
`autorepair`, `advice` or `none`. Tracking SHALL be a separate switch with
global/topic/rule inheritance. `none` SHALL hide findings without discarding
observations; disabled tracking SHALL skip new checks. `advice` SHALL
report findings without changing files. `autorepair` SHALL be accepted only
where the catalogue names an idempotent core-owned repair; otherwise it SHALL
resolve to advice and explain why. Findings SHALL not be presented as repaired
until the post-repair check passes.

#### Scenario: A rule is configured as none

- **WHEN** its reaction is `none`
- **THEN** its observations remain cached but hidden in the normal view
- **AND** it is not automatically repaired

#### Scenario: A rule is configured as advice

- **WHEN** it finds a violation under `advice`
- **THEN** it records evidence and proposes no file mutation

#### Scenario: An unsupported repair is requested

- **WHEN** `autorepair` is selected for a rule without an approved repair
- **THEN** the effective reaction is advice and the user sees the reason

#### Scenario: An automatic repair is attempted

- **WHEN** an allowlisted repair runs
- **THEN** it changes only its declared file and reports success only after rechecking

#### Scenario: Repair safety is not confirmed before mutation

- **WHEN** a permitted explicit or automatic repair encounters a known safety refusal
- **THEN** no repair write is performed and the finding remains with persisted advice explaining the refusal and a safe next step
- **AND** the configured reaction remains unchanged, no success is claimed and no immediate retry loop starts
- **AND** permission refusals and unexpected technical or post-write failures remain explicit errors rather than being disguised as safe skips

### Requirement: Periodic checks are opt-in, idle-only and workload bounded

The periodic monitor SHALL default to disabled and SHALL not create a detached
OS process. When enabled, the host SHALL run checks only after reporting idle,
while no mutating Workbench process is active. Core SHALL run at most one check
at a time and stop when the configured per-idle-slice budget is exhausted.
Unfinished checks SHALL be deferred to a later idle window.

#### Scenario: Periodic monitoring is disabled

- **WHEN** the global switch is off
- **THEN** initialization checks remain available but no periodic timer or check starts

#### Scenario: The host is active or a mutation is in progress

- **WHEN** the host is not idle or the workspace mutation lease is held
- **THEN** periodic compliance work does not start

#### Scenario: An idle slice reaches its budget

- **WHEN** the next rule would exceed the slice budget
- **THEN** that rule and later work are deferred without starting another worker

#### Scenario: A check has no cost history

- **WHEN** the planner has no measured duration for a rule
- **THEN** it uses the conservative cost class and defers expensive work when needed

### Requirement: Check cost and evidence stay bounded and local

Core SHALL record check wall duration and bounded recent CPU-time measurements
where the host provides them, for scheduling.
Settings and measurements SHALL be stored outside the checkout and shared by
sibling worktrees using the repository's canonical identity. Persisted findings
SHALL contain rule ids, short evidence and outcomes, not source contents or
command output.

#### Scenario: A check completes

- **WHEN** a check completes
- **THEN** its duration contributes to the bounded cost history

#### Scenario: Two worktrees of one repository are open

- **WHEN** either worktree reads compliance settings or cost history
- **THEN** both resolve the same per-repository user state

#### Scenario: Evidence is persisted

- **WHEN** a finding is stored
- **THEN** the record contains bounded evidence and no repository file contents

### Requirement: Compliance opens from shared observations without executing work

Core SHALL accept bounded typed observations from existing sweeps, surveys and
checks into a repository-scoped cache. Opening Compliance, switching tabs,
scrolling or expanding details SHALL read only cached data. Sweep findings
SHALL identify Sweep as their independent owner and SHALL expose no Compliance
repair controls. `Read remaining` SHALL check only missing/stale subjects,
serially with progress, resource limits and cancellation, without invoking
`sweepWorkspace` or implicit repairs.

#### Scenario: Cached results are opened

- **WHEN** the user opens Compliance or expands a cached finding
- **THEN** no check, Git invocation, sweep or repair is started

#### Scenario: Sweep contributes an observation

- **WHEN** an existing sweep records a result
- **THEN** Compliance displays its source and Sweep ownership read-only
- **AND** changing Compliance policy cannot affect Sweep behavior

#### Scenario: Explicit completion is cancelled

- **WHEN** the user cancels Read remaining or closes its window
- **THEN** no next step starts and completed observations remain available

### Requirement: Results are detailed, live and lazily rendered

Compliance SHALL expose producer, subject identity, repository/worktree/change,
branch and full path where available, with separate checked and changed UTC
timestamps and bounded non-secret evidence. A newer successful observation
SHALL update the displayed item; a confirmed pass SHALL remove the active
problem. Unknown, stale and disabled states SHALL NOT erase a finding.
Results and Settings SHALL share one repository-wide window opened from the
Changes toolbar, with icon-and-text tabs, switch tracking and dropdown reaction
controls. Topic and rule controls SHALL support inheritance. Sorting SHALL
include topic, severity, name, checked time and changed time over the full
cache. Lazy rendering SHALL preserve focus, expansion and scroll.

#### Scenario: An unchanged problem is checked again

- **WHEN** a check confirms the same problem with the same evidence
- **THEN** checked time advances while changed time remains unchanged

#### Scenario: A problem cannot be checked

- **WHEN** a subsequent observation is unknown or tracking is disabled
- **THEN** the known problem remains with explicit uncertainty or tracking state

#### Scenario: A problem is confirmed resolved

- **WHEN** a fresh successful check reports pass for the same subject
- **THEN** the active problem disappears and the latest check time remains known

#### Scenario: A lazily loaded list is sorted

- **WHEN** results are sorted or filtered before all rows are loaded
- **THEN** sorting, filtering and counts include the complete cached result set
