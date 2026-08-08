# OpenSpec Workbench for VS Code

OpenSpec Workbench brings the complete OpenSpec change workflow into VS Code.
It uses native tree views, markdown editors, diffs, Source Control, Chat, and
notifications while keeping lifecycle and security behavior in
`@openspec-ui/core`.

## Features

- Navigate `config.yaml`, active changes, archived changes, canonical specs,
  and every proposal, design, task list, and delta spec.
- Create, validate, archive, unarchive, and delete changes from contextual
  actions with confirmation for destructive operations.
- See queued, running, completed, failed, and cancelled operations in the
  Processes view. Mutations for the same change are serialized while work on
  independent changes may run concurrently.
- Use `@openspec` in VS Code Chat with `/plan`, `/implement`, `/review`,
  `/status`, and `/validate`.
- Start checkpointed VS Code Agent implementation sessions, finish them for
  review, and roll back only the files changed by that session. Rollback refuses
  to overwrite files edited after the run.
- Open native markdown and diff editors instead of custom replacements.

## Requirements

- VS Code 1.90 or newer.
- OpenSpec CLI available as `openspec` on `PATH`.
- A workspace containing `openspec/config.yaml`, or initialize OpenSpec from
  the CLI before using the Workbench.
- VS Code Chat and an available language model for `/plan`, `/implement`, and
  `/review`. Deterministic lifecycle, status, and validation actions do not
  require AI.

## Workflow

1. Open the OpenSpec activity-bar container.
2. Create or expand a change in **Changes**.
3. Edit Proposal, Design, Tasks, and delta Specs in native editors.
4. Run Validate, then choose **Implement with VS Code Agent**.
5. Follow the run in **Processes**. When Agent work is done, choose
   **Finish Implementation & Review**.
6. Review native diffs, roll back the checkpoint if needed, or archive the
   completed change. Archiving creates or updates canonical specs.

## Chat

Enter `@openspec` and choose a slash command. The first argument must be an
active change id:

```text
@openspec /review openspec-workbench focus on rollback safety
```

## Settings

- `openspec-ui.transport.localServer.enabled`: use the optional standalone
  REST/WS shell inside the dashboard. The default extension path imports core
  directly and uses an in-process message bridge.

## Development

```bash
npm run typecheck --workspace openspec-ui-vscode
npm run lint --workspace openspec-ui-vscode
npm run test --workspace openspec-ui-vscode
npm run build --workspace openspec-ui-vscode
npm run test:integration --workspace openspec-ui-vscode
```
