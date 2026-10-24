## ADDED Requirements

### Requirement: Cost reports survive a change being archived

show cost SHALL resolve active and archived changes without requiring an
active tasks.md. It SHALL select retained repository audit by the logical
change identity, including entries written at a removed worktree's old
path. Unknown, invalid, or ambiguous reused names SHALL be refused without
guessing an archive generation or reading arbitrary external paths.

#### Scenario: An archived change still has recorded usage

- **WHEN** a change has moved to archive and its audit records remain
- **THEN** show cost by its original name or unique dated archive name succeeds with the recorded totals
- **AND** no active task list is required

#### Scenario: A name cannot identify one change

- **WHEN** the name is invalid, unknown, or reused across ambiguous archive generations
- **THEN** show cost returns a refusal with clean stdout instead of an invented zero report

### Requirement: CLI reports disclose usage and model capabilities clearly

show cost SHALL expose retained token fields, USD coverage, and any
current-model attribution limit in text and JSON. Unknown USD SHALL NOT
be emitted as zero. show agents SHALL expose acceptsModel in both formats
and SHALL retain effort capabilities. show run SHALL preserve the requested
model and invocation id from audit; show history remains change history.

#### Scenario: A token-only agent's usage is shown

- **WHEN** show cost displays recorded tokens without a USD report
- **THEN** JSON omits costUsd and text says USD was not reported

#### Scenario: An agent takes a model through a session option

- **WHEN** show agents lists codex-cli-acp in text or JSON
- **THEN** it states acceptsModel is true and retains its effort levels
