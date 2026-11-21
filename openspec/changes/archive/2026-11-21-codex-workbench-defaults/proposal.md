## Why

An unconfigured command and the repository setup picker currently select Claude first. The maintainer requested Codex ACP as the default on 2026-11-21. ADR 0017 keeps agent adapters behind the shared registry.

## What Changes

- Replace Claude stage assignments and Claude-model assignments with codex-cli-acp.
- Give unassigned agent stages an explicit Codex ACP default.
- Let replaced Codex assignments use Codex's configured model.
- Set the shared default agent and the setup picker's initial choice to Codex ACP.

## Capabilities

### New Capabilities

- workbench-agent-defaults: active repository agent assignments and Codex default selection.

### Modified Capabilities

- None.

## Impact

Workbench configuration and its verification records.

## Changelog

openspec-ui-vscode, @openspec-ui/server and @openspec-ui/cli
- New sessions and unconfigured runs use Codex CLI (ACP). Repository setup offers Codex first when installed. Users can still select either Claude adapter with its supported settings.
