# The Harness Asks Before Pushing

## Why

[ADR 0042](../../../docs/adr/0042-the-agent-asks-the-operator.md) pauses the chain when an agent asks for a decision. [Qingfeng's review](https://dev.to/someone_somewhere_05cad9e/the-agent-asks-the-operator-and-the-chain-waits-5b48#comments) points out that the agent can proceed without asking, so a rule that requires authorization for a remote write needs a trigger in the runtime.

## What Changes

- Let a change set `gitStageAllowlist.requirePushApproval` in its own `harness.json`. Before a permitted push in the Harness `git` stage, show the operator the commit, remote repository and destination branch and wait for an explicit decision under every autonomy level.
- Apply an approval once to that pending push. If its commit or destination changes, invalidate the approval and require a fresh request before any push. Record the request, decision and outcome in the audit log.
- Continue to refuse actions outside the allowlist. Treat answers to questions about the change as input to the agent, separate from authorization to write to a remote.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agentic-harness` — per-change approval of the exact push that the Harness is about to execute.

## Impact

Core owns policy, approval state and Git invocation. The VS Code extension and standalone app use the existing permission controls. The CLI prompts in an interactive run and refuses the push if it cannot ask. The feature covers the Harness `git` stage's own push. [ADR 0055](../../../docs/adr/0055-the-harness-authorizes-a-specific-push.md) defines the boundary.

## Changelog

Affected deliveries: `openspec-ui-vscode`, `@openspec-ui/server`, and `@openspec-ui/cli`.

- Require approval for a change's Harness Git push from its `harness.json`. The approval shows the commit and destination and applies only to that push. An unattended CLI run stops before pushing when approval is required.
