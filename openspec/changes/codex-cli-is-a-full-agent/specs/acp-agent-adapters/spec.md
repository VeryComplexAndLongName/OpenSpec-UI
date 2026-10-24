## MODIFIED Requirements

### Requirement: Existing raw-text adapters are unaffected

The system SHALL NOT change the behavior, event shape, or output handling of
today's `claude-cli`, `copilot-cli`, `gemini-cli`, or `local-llm` adapters
because of an ACP-flavored adapter. ACP-flavored adapters are additional
entries, not replacements. `codex-cli` reads its CLI's own event stream and
names its sandbox (codex-cli-is-a-full-agent, ADR 0051); it still emits no
`agentUpdate` or `permissionRequest` events.

#### Scenario: Non-ACP adapter still used by an existing consumer
- **WHEN** a client selects today's `claude-cli` adapter (not its ACP-flavored
  counterpart)
- **THEN** the run behaves exactly as before this change, with no
  `agentUpdate` or `permissionRequest` events

## ADDED Requirements

### Requirement: Codex CLI runs in a named sandbox and reports what its stream says

The `codex-cli` adapter SHALL run `codex exec --json` and SHALL always name
the sandbox: `workspace-write` for a command whose stage writes the change
(`plan`, `implement`, `update`, `verify`) and `read-only` for every other
command. The allowlist SHALL refuse an invocation that names no sandbox,
names `danger-full-access`, or bypasses approvals and the sandbox.

The adapter SHALL pass a stage's `model` with `--model`. It SHALL tell the
stream's agent messages, the commands the agent runs, a failed command's
exit code with the end of its output, and the files it changed, as the
run's text; SHALL report the turn's usage as tokens, with cached input
apart from input; and SHALL fail a run whose turn the stream reports
failed, though `codex` exits 0 (`OSW-AGT-222`).

#### Scenario: An apply stage on codex

- **WHEN** an `implement` command runs on `codex-cli`
- **THEN** `codex` is run with `--sandbox workspace-write`, and the files
  it writes in the change's directory are written

#### Scenario: A review on codex

- **WHEN** a `review` command runs on `codex-cli`
- **THEN** `codex` is run with `--sandbox read-only`

#### Scenario: Full access refused

- **WHEN** an invocation of `codex` names `--sandbox danger-full-access`, or
  none
- **THEN** the allowlist refuses it and nothing is run

#### Scenario: A turn that failed

- **WHEN** the stream reports `turn.failed` with "model gpt-x is not
  available" and `codex` exits 0
- **THEN** the run fails with "codex reported the turn failed: model gpt-x
  is not available"
