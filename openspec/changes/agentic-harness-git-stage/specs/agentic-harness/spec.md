## ADDED Requirements

### Requirement: The `git` stage executes push, pull-request creation, and merge in sequence

When a chain (`agentic-harness-autonomy`'s `HarnessChainRunner`) reaches the
`"git"` stage, the system SHALL push the change's branch, open a pull
request, and merge it, in that order, as a single stage — using the same
`checkpoint`/`stageCompleted` semantics every other stage already uses (one
`checkpoint` before the stage starts for `semi-autonomous`, one
`stageCompleted`/`completed` after the whole sequence finishes; no
per-action pause within the sequence).

#### Scenario: `git` stage runs after `archive` under `agent-sufficient`

- **WHEN** a chain reaches the `git` stage and the resolved
  `reviewGate.mode` is `"agent-sufficient"`
- **THEN** the system pushes the branch, opens a pull request, and merges
  it, emitting one `checkpoint` (or none, under `autonomous`) before the
  sequence and one `stageCompleted`/`completed` after it

### Requirement: The `git` stage never executes unless `reviewGate.mode` resolves to `agent-sufficient`

The system SHALL NOT push, open a pull request, or merge unless the
resolved `reviewGate.mode` for that change is `"agent-sufficient"`. Under
the default `"human-required"`, a chain SHALL stop cleanly after `archive`,
exactly as it did before this change existed.

#### Scenario: Default review gate stops the chain before git actions

- **WHEN** a chain reaches the point after `archive` and the resolved
  `reviewGate.mode` is `"human-required"` (the default)
- **THEN** the chain ends with `completed` without pushing, opening a pull
  request, or merging anything

#### Scenario: No global default can enable the git stage

- **WHEN** `openspec/agent-harness.json` (global) sets `reviewGate.mode:
  "agent-sufficient"`
- **THEN** the system rejects that global file exactly as it already does
  today (`GlobalAgentSufficientReviewGateError`) — this requirement does
  not introduce any new way to reach `agent-sufficient` globally

### Requirement: A per-change remote/branch allowlist gates every push, pull-request, and merge action

The system SHALL check every `git push`, pull-request creation, and merge
action against an explicit allowlist resolvable only from a per-change
`harness.json` (never the global `openspec/agent-harness.json`), reusing
the existing `checkAllowlist`/`AllowlistConfig` mechanism
(`packages/core/src/security.ts`) that already gates CLI-agent invocations.
An action not matched by the allowlist SHALL be blocked before it runs.

#### Scenario: Push to a remote/branch not in the allowlist

- **WHEN** the git stage attempts to push to a remote/branch combination
  not present in the per-change allowlist
- **THEN** the push is blocked before it runs, and the chain ends with
  `failed` naming the reason

#### Scenario: Global file cannot grant a git-stage allowlist

- **WHEN** `openspec/agent-harness.json` (global) attempts to set a
  git-stage allowlist entry
- **THEN** the system rejects that global file, mirroring the existing
  `GlobalAgentSufficientReviewGateError`/`GlobalAutonomousAutonomyLevelError`
  pattern for other per-change-only settings

### Requirement: A pull request is never merged while its checks have not passed

The system SHALL wait for the pull request's own checks to finish and
SHALL merge only when they have all passed. A pull request whose checks
failed, or for which no check result can be obtained, SHALL NOT be merged;
the stage SHALL end with `failed` naming the check state it saw.

This SHALL NOT be configurable. No configuration value, and no allowlist
entry, SHALL permit merging past a check that has not passed.

#### Scenario: Checks pass

- **WHEN** the git stage has opened a pull request and every check on it
  finishes successfully
- **THEN** the pull request is merged and the stage completes

#### Scenario: A check fails

- **WHEN** a check on the pull request finishes unsuccessfully
- **THEN** the pull request is not merged, and the stage ends with
  `failed` naming the failing check

#### Scenario: No check result is available

- **WHEN** the pull request reports no checks at all
- **THEN** the pull request is not merged, and the stage ends with
  `failed` saying no check result was available — an absent result is
  treated as a refusal, not as permission

#### Scenario: The pull request is left open for a human

- **WHEN** the stage refuses to merge for either reason above
- **THEN** the pushed branch and the open pull request remain, so the
  work is not lost and a human can take it from there

### Requirement: Every git-stage action is audited

The system SHALL write an audit log entry (reusing the existing
`AuditLog`/`AuditEntry` shape in `packages/core/src/security.ts`) for every
push, pull-request creation, and merge attempt, regardless of whether it
succeeded, failed, or was blocked by the allowlist.

#### Scenario: Blocked action is still audited

- **WHEN** a push is blocked by the remote/branch allowlist
- **THEN** the audit log still contains an entry for that attempt, with
  outcome `"blocked"`

## MODIFIED Requirements

### Requirement: `reviewGate.mode: "agent-sufficient"` is never a valid global setting

The system SHALL reject a global `openspec/agent-harness.json` that sets
`reviewGate.mode` to `"agent-sufficient"`; that value SHALL only be
accepted in a per-change `harness.json`. `agent-sufficient` now has an
observable effect: it is the sole condition under which the `git` stage
executes push/pull-request/merge instead of the chain stopping after
`archive`.

#### Scenario: Global file attempts to set agent-sufficient

- **WHEN** `openspec/agent-harness.json` sets `reviewGate.mode:
  "agent-sufficient"`
- **THEN** the system reports a clear validation error and does not
  resolve or apply that value

#### Scenario: Per-change file sets agent-sufficient

- **WHEN** a per-change `harness.json` sets `reviewGate.mode:
  "agent-sufficient"`
- **THEN** the resolved configuration for that change uses
  `agent-sufficient`, without affecting any other change's resolved
  configuration, and a chain for that change proceeds into the `git` stage
  instead of stopping after `archive`
