## ADDED Requirements

### Requirement: Agents verify locally with checks scoped to their change

Every agent planning, implementing, reviewing, or verifying work in this
repository SHALL use only targeted local checks for the changed behavior
and directly affected callers or contracts. The agent SHALL name the
selected test files or test names, lint paths, affected TypeScript
projects, or relevant smoke scenarios and record what passed.

Full repository verification and unfiltered test, browser, or integration
suites, including complete suites within one package, SHALL run only in
CI. Splitting such a run across commands, worktrees, or agents SHALL NOT
be treated as targeted verification.

The policy SHALL be delivered through openspec/config.yaml's context,
task rules, and operation guidance. CLAUDE.md SHALL point to that policy
instead of requesting workspace-wide local checks. New local task lists
SHALL NOT declare check(test), check(lint), or check(typecheck), which
expand to unscoped root npm commands in this repository's Harness.
Full-suite verification SHALL remain a CI gate rather than an item in
the local tasks.md checklist or a pre-commit prerequisite.

#### Scenario: An agent verifies a changed component

- **WHEN** an agent changes a component or a directly affected contract
- **THEN** it selects the relevant local test files or test names and scoped static checks
- **AND** it leaves complete verification to the existing CI gates

#### Scenario: OpenSpec produces instructions for a new change

- **WHEN** an agent requests planning or task instructions
- **THEN** the generated instructions state that local checks are targeted and full runs are CI-only
- **AND** task rules prohibit local mechanical declarations that invoke broad root checks

#### Scenario: An agent considers a full local run

- **WHEN** a local command would run an entire suite or all workspace verification
- **THEN** the agent uses selected relevant checks locally and obtains the full result from CI
- **AND** it does not reproduce the full run in separate batches or worktrees

#### Scenario: A targeted local check passes

- **WHEN** selected checks pass before the pull request is submitted
- **THEN** the agent records their scope and results as local evidence
- **AND** it reports complete verification as pending until CI reports it
