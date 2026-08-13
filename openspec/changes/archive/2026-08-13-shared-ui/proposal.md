## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` requires a single set of
UI components for Changes/Archive/Specs/Tasks/AI panel that behaves the same
in browser standalone and in VS Code Webview, without duplicated layout or
display logic between delivery forms.

This depends on `execution-core` (command/event protocol and derived
change-state), which is the data source for `webui`.

## What Changes

- Add a `Transport` interface with two implementations:
  `FetchTransport` (REST/WS to `server`, for standalone and optional extension
  mode) and `MessageBridgeTransport` (`postMessage`/`acquireVsCodeApi`,
  primary extension mode).
- Add views: Changes list (status from `execution-core` derived state,
  archived-version diff), Archive (search/filters/history), Specs (tree view,
  read-only markdown requirements rendering; editing delegated to host: VS Code
  in extension, minimal editor+preview in standalone), Tasks (checklist,
  progress, run a single task via `implement` scoped to one item), AI panel
  (agent picker and one command form for `plan`/`implement`/`review`, using
  `execution-core` protocol independent of active `Transport`).

## Capabilities

### New Capabilities
- `shared-ui`: transport-agnostic React components for
  Changes/Archive/Specs/Tasks/AI reused by standalone and VS Code extension.

### Modified Capabilities
(none)

## Impact

New code: `packages/webui/`. Depends on protocol types exported by
`packages/core` (`execution-core`), not directly on `packages/server`
(`server` is only one possible `Transport`).