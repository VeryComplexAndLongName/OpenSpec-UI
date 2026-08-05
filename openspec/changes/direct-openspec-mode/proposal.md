## Why

AI-agent execution paths are unreliable or too slow in the current environment,
which makes the extension and standalone UX unpredictable. Users need a stable,
fast workflow based on native OpenSpec JSON commands.

## What Changes

- Remove user-facing AI-agent execution actions from the extension.
- Keep command-panel workflows focused on direct OpenSpec commands.
- Route direct command execution (`status`, `list`, `show`, `validate`) through
  OpenSpec `--json` commands in both extension and standalone paths.
- Render status results with structured UI elements and render other command
  JSON output in readable structured blocks instead of plain text streams.

## Impact

- `packages/extension`: command surface and configuration simplified to
  direct OpenSpec mode.
- `packages/server`: no default AI runner bootstrap; JSON-first status endpoint.
- `packages/webui`: direct command picker (`status`/`list`/`show`/`validate`) and
  non-blocking JSON output rendering.
- `packages/core`: typed wrappers used for direct JSON command execution.
