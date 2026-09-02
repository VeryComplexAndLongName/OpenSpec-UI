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
| [0008](0008-change-scoped-rollback-and-retention.md) | Change-scoped rollback instead of task-scoped, with opt-in retention | Accepted |
| [0009](0009-publish-cli-to-npm.md) | Publish `@openspec-ui/cli` to npm as a bundled package | Accepted |
| [0010](0010-cross-host-workspace-lease.md) | Cross-host workspace lease (advisory lock, v1) | Proposed |
| [0011](0011-agentic-harness-config-and-autonomy-levels.md) | Agentic Harness config and autonomy levels | Accepted |
| [0012](0012-agentic-harness-chain-execution-protocol.md) | Agentic Harness chain-execution protocol (`semi-autonomous`/`autonomous`) | Accepted |
| [0013](0013-acp-agent-adapters.md) | ACP-flavored agent adapters (Agent Client Protocol) | Accepted |
| [0014](0014-agentic-harness-git-stage.md) | Agentic Harness `git` stage (push / PR / merge) | Proposed |
| [0015](0015-agentic-harness-per-stage-model-selection.md) | Agentic Harness per-stage model selection | Accepted |
| [0016](0016-harness-stage-dispatch-via-vscode-chat.md) | Harness stage dispatch via the VS Code chat | Accepted |
| [0017](0017-structured-agent-output-parsing.md) | Structured agent output: parsing discipline and graceful degradation | Accepted |
| [0018](0018-event-driven-harness-orchestration.md) | Event-driven harness orchestration | Accepted |
| [0019](0019-mechanical-task-checks.md) | Mechanical task checks | Accepted |

New architecture-impacting changes must add an ADR and reference it from the related OpenSpec change.
