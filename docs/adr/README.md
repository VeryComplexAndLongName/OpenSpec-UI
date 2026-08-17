# Architecture Decisions (ADR)

Decision branches between alternatives and their rationale are not the current
behavior of a specific capability (that lives in `openspec/specs/` after the
first `apply`/`archive`). Format: Status / Context / Decision / Rejected
Alternatives / Consequences.

| # | Title | Status |
| --- | --- | --- |
| [0001](0001-shared-core-two-delivery-targets.md) | Shared core/webui monorepo, two delivery targets (standalone + VS Code extension) | Accepted |
| [0002](0002-direct-openspec-mode-no-agent-orchestration.md) | Direct OpenSpec mode for user command execution | Accepted |
| [0003](0003-native-vscode-openspec-workbench.md) | Native VS Code OpenSpec Workbench | Accepted |
| [0004](0004-persistent-workbench-runs.md) | Persistent Workbench runs and delivery parity | Accepted |
| [0005](0005-authenticated-local-transport.md) | Authenticated local REST and WebSocket transport | Accepted |
| [0006](0006-fail-closed-journal-compatibility.md) | Fail-closed journal compatibility | Accepted |
| [0007](0007-ci-cli-third-delivery-target.md) | CI CLI as a third thin delivery target | Accepted |

New architecture-impacting changes must add an ADR and reference it from the related OpenSpec change.