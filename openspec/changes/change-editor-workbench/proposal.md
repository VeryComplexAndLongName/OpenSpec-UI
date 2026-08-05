## Why

Users need a dedicated workflow for creating and editing OpenSpec changes before
implementation starts. The current command panel is optimized for command
execution and status visualization, but not for authoring proposal/design/tasks
content.

## What Changes

- Add a specialized Change Editor workflow in the standalone UI.
- Support creating a new change from the UI.
- Support loading and editing proposal/design/tasks/spec markdown files.
- Support saving edited markdown back to the selected change.
- Add markdown preview to make authoring easier.
- Add a guided OpenSpec initialization flow when workspace has no OpenSpec artifacts.

## Impact

- `packages/server`: new REST endpoints for create/read/save editor flows and OpenSpec init flow.
- `packages/webui`: new authoring UI section with markdown editing/preview and initialization UI.
- `packages/core`: wrappers reused for list/create flows plus OpenSpec init wrapper.
