# Proposal

## Why

Turning a forge issue into a change currently requires copying its request by hand, which loses its origin. ADR 0001 requires one Core workflow for both hosts and treats external content as data; an issue must seed Propose without becoming an approved specification or starting an agent implicitly.

## What Changes

- Preview an issue from the workspace's GitHub, GitLab or Gitea repository by number or matching issue URL.
- Confirm the preview to create a change using the existing worktree/share workflow, retaining a bounded source snapshot. Refuse a changed preview before creating anything.
- Include that snapshot as untrusted reference data in the existing Propose context; generating the actual proposal remains an explicit Run Change action.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-editor-workbench`: confirmed issue sources for new changes in standalone and native VS Code.

## Impact

Core Forge readers, source validation and prompt context; thin REST/native commands and a standalone form. No new agent command/event, dependency, automatic issue edit, PR, merge or agent launch.

## Changelog

Affected public deliveries: `openspec-ui-vscode`, `@openspec-ui/server`, and the Workbench bundled with `@openspec-ui/cli` after launch-workbench-from-npm lands.

- Preview a GitHub, GitLab or Gitea issue and create a change with its source attached. The existing Propose stage reads the snapshot; running an agent still requires a separate action. Issues must belong to the workspace repository.
