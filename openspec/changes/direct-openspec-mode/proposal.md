## Why

AI-agent execution paths are unreliable or too slow in the current environment,
which makes the extension and standalone UX unpredictable. Users need a stable,
fast workflow based on native OpenSpec JSON commands.

## What Changes

- Remove user-facing AI-agent execution actions from the extension.
- Keep command-panel workflows focused on direct OpenSpec commands.
- Route status execution through `openspec status --json` in both extension and
  standalone paths.
- Render status results with structured UI elements instead of plain text.

## Impact

- `packages/extension`: command surface and configuration simplified to
  direct OpenSpec mode.
- `packages/server`: no default AI runner bootstrap; JSON-first status endpoint.
- `packages/webui`: status-only run panel and structured status rendering.
- `packages/core`: typed status JSON wrapper.
