## Why

Raised directly in a repository conversation on 2026-08-31: creating an
OpenSpec change (`openspec-ui.createChange`) and configuring its Agentic
Harness override (`openspec-ui.configureHarnessForChange`) are two
separate actions today — a user who wants a specific agent/autonomy split
for a new change (e.g. this repository's own current default: Claude
proposes/reviews/archives, GitHub Copilot implements — see
`openspec/agent-harness.json`) has to run both commands and separately
open/hand-edit the resulting `harness.json`. There is no single flow that
creates the change and asks, right there, whether this one should deviate
from the global default.

## What Changes

- New command `openspec-ui.createChangeTemplate` ("OpenSpec UI: Create
  Change Template") — VS Code only for this change (see design.md,
  "Standalone webui" for the smaller follow-up there). Creates the change
  scaffold (same `createChange()` core call as `openspec-ui.createChange`),
  then asks "Use global Agentic Harness defaults" or "Customize for this
  change." If customizing: a sequential QuickPick wizard asks for
  `propose`/`review`/`apply`/`archive`'s agent (each offering "(inherit
  from global default)" plus every `AGENT_REGISTRY` entry), then
  `autonomyLevel`, then `reviewGate.mode` — `git` is deliberately not
  asked (see design.md, "Why `git` is not part of the wizard").
  Cancelling (Esc) at any wizard step abandons the whole customization
  (the change itself is still created, already-collected answers are
  discarded) rather than writing a partial file.
- Writes `openspec/changes/<id>/harness.json` via the existing
  `writeChangeHarnessConfig`, and only if at least one answer actually
  deviated from "(inherit)"/the default — an all-inherit pass through the
  wizard writes nothing, matching "Use global defaults"'s behavior.
- No change to `openspec-ui.createChange`'s existing behavior — this is an
  additional command, not a replacement.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness` and `vscode-extension`)

### Modified Capabilities

- `agentic-harness`: a combined "create change + optionally configure its
  harness override in one flow" entry point.
- `vscode-extension`: new command + Changes view "..." menu entry.

## Impact

- `packages/extension/src/commands.ts`: new `openspec-ui.createChangeTemplate`
  handler.
- `packages/extension/package.json`: command registration + `view/title`
  contribution (Changes view "..." overflow menu, not the toolbar — see
  design.md).
- `openspec/specs/agentic-harness/spec.md`: new requirement for the
  combined create-and-configure flow.
