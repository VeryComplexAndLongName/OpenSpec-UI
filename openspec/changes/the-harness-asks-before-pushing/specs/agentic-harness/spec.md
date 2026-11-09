## ADDED Requirements

### Requirement: The Harness can require approval for its exact Git push

A change MAY set `gitStageAllowlist.requirePushApproval` in its own
`harness.json`. The Harness SHALL apply the per-change allowlist before
asking and SHALL withhold an allowed push in its `git` stage until the
operator explicitly approves it, at every autonomy level. The request
SHALL identify the run, request ID, full source commit ID, remote,
credential-free repository identity and full destination branch ref.

Approval SHALL authorize one attempt of that single-ref push. Immediately
before dispatch the Harness SHALL recheck the action and the allowlist.
A changed commit, branch, endpoint or applicable policy SHALL invalidate
the approval. Execution SHALL use the pinned source and destination, normal
fast-forward rules and the remote's protections. The invocation SHALL
exclude additional refs, tag or submodule pushes, mirror mode, force and
deletion. The Harness SHALL refuse a destination it cannot bind.

The Harness SHALL audit the request, decision, invalidation when
applicable, and push outcome without exposing credentials. A denied,
cancelled, expired or unavailable approval SHALL leave the push unattempted
and prevent downstream actions in that Git stage. A duplicate or stale
resolution SHALL have no effect. Answers in `decisions.md` SHALL confer no
permission. When the option is absent or false, the existing Git-stage
policy SHALL apply.

#### Scenario: An autonomous run reaches an allowed push

- **WHEN** an autonomous run whose change requires push approval reaches an allowed push, and the agent has emitted no questions
- **THEN** the Harness presents the exact push to the operator and waits
- **AND** it dispatches that push once after receiving Allow for the pending run and request ID

#### Scenario: A policy forbids the destination

- **WHEN** the destination does not match the per-change allowlist
- **THEN** the Harness refuses the action without offering an approval

#### Scenario: The prepared action changes

- **WHEN** the source commit or remote destination changes after approval and before dispatch
- **THEN** the Harness invalidates the approval and performs no push
- **AND** a retry must request a new approval for the newly prepared action

#### Scenario: An answer selects a branch strategy

- **WHEN** the operator has answered an agent's design question with `gitflow` and the chain reaches a push requiring approval
- **THEN** the Harness still requires a decision for the pending push

#### Scenario: Approval cannot be obtained

- **WHEN** the operator denies the request, the run is cancelled, or the CLI has no interactive prompt
- **THEN** the Harness does not push or create a pull request
