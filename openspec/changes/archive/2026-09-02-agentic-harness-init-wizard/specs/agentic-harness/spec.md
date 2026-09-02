## ADDED Requirements

### Requirement: A guided first-run flow configures the global Agentic Harness default

The VS Code extension SHALL offer a re-runnable "Set Up Agentic Harness"
flow that detects available CLI agents and asks the user to choose a
control agent (`propose`/`review`/`archive`), an apply agent (`apply`),
and an autonomy level, writing each answer to the global
`openspec/agent-harness.json` as it is given. Only autonomy levels valid
in the global file (`assisted`, `semi-autonomous`) SHALL be offered.
Successfully initializing a workspace that has no existing
`openspec/agent-harness.json` SHALL surface a dismissible suggestion to
run this flow.

#### Scenario: No agents detected

- **WHEN** the flow runs and `detectAvailableAgents()` reports no
  available agent
- **THEN** the agent/autonomy questions are skipped with an explanatory
  message, and the flow proceeds directly to the CLAUDE.md/AGENTS.md
  question

#### Scenario: Each answer is written immediately

- **WHEN** the control-agent question is answered
- **THEN** the global `openspec/agent-harness.json` reflects that answer
  before the next question is asked, not only after the whole flow
  completes

#### Scenario: Cancelling preserves already-given answers

- **WHEN** the flow is cancelled (Esc) after the control-agent question
  but before the apply-agent question
- **THEN** the global file retains the control-agent answer already
  written, and no further questions are asked

#### Scenario: `autonomous` is never offered globally

- **WHEN** the autonomy-level question is presented
- **THEN** its choices are limited to `assisted` and `semi-autonomous` —
  `autonomous` does not appear, matching the global file's existing
  validation restriction

#### Scenario: Initializing a workspace with no existing harness config suggests the flow

- **WHEN** `openspec-ui.initialize` completes successfully and
  `openspec/agent-harness.json` does not already exist
- **THEN** a dismissible suggestion to run "Set Up Agentic Harness"
  appears

#### Scenario: Initializing an already-configured workspace does not re-suggest

- **WHEN** `openspec-ui.initialize` completes successfully and
  `openspec/agent-harness.json` already exists
- **THEN** no suggestion appears

### Requirement: Choosing `claude-cli` warns on a CLI version mismatch, without blocking

Implemented only once `acp-agent-adapters` has landed (see design.md,
"Ordering against `acp-agent-adapters`" — this requirement does not apply
before then). When `claude-cli` is chosen for the control or apply role,
the flow SHALL check the installed `claude` CLI's version against the
version `acp-agent-adapters`'s `claude-cli-acp` translation layer was last
verified against, and show a dismissible warning on a mismatch, without
blocking the flow from continuing.

#### Scenario: Installed Claude CLI version matches the tested version

- **WHEN** `claude-cli` is chosen for a role and the installed `claude
  --version` matches the tested-version constant
- **THEN** no warning is shown

#### Scenario: Installed Claude CLI version differs from the tested version

- **WHEN** `claude-cli` is chosen for a role and the installed `claude
  --version` does not match the tested-version constant
- **THEN** a dismissible warning names both versions and points at
  `docs/adr/0013-acp-agent-adapters.md`, and the flow still allows
  continuing

#### Scenario: `claude --version` cannot be determined

- **WHEN** `claude-cli` is chosen for a role but running `claude
  --version` fails
- **THEN** the check is skipped silently and no warning is shown
