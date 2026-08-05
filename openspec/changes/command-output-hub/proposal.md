## Why

Current command execution UX is too close to raw CLI output: users see mostly
plain lines for `plan`/`implement`/`review`/`status`, which underuses the
existing UI surface and reduces readability.

We also need practical command entry points for OpenSpec workflows from the
extension UI, including `openspec view`, while preserving protocol and
security boundaries defined in `docs/adr/0001-shared-core-two-delivery-targets.md`.

## What Changes

- Upgrade AI panel event rendering from plain line output to structured UI
  blocks with lightweight parsing for common output shapes.
- Coalesce fragmented stream chunks so users read complete thoughts/steps
  instead of transport-fragmented tokens.
- Add run-level analysis block (steps, warnings, terminal result) above raw
  chronology for faster interpretation.
- Extend AI panel command picker to include `status` in the same unified
  protocol workflow.
- Add extension command entries for OpenSpec utility flows such as
  `openspec view` and parsed, UI-friendly views for selected change details,
  strict validation summaries, and a parsed `openspec view` companion summary.
- Add standalone parsed `openspec view` summary panel backed by server REST
  endpoint (`/api/overview`).

## Capabilities

### New Capabilities
- `command-output-hub`: structured command output rendering and OpenSpec
  utility command entry points in the extension UI.

### Modified Capabilities
- `shared-ui`: AI panel event display and command picker behavior.
- `vscode-extension`: command palette coverage for OpenSpec utility actions.

## Impact

- `packages/webui`: AI panel rendering and styles.
- `packages/extension`: command registration and command handlers.
- `packages/server`: overview REST endpoint for parsed standalone summary.
- `openspec/changes/command-output-hub/specs/`: requirement contract for this
  behavior.
