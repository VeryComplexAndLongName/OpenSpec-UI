## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` requires a standalone
delivery form for users without VS Code. This change depends on
`execution-core` (protocol/logic) and `shared-ui` (views) and adds only the
delivery layer: thin REST/WS server + browser shell.

## What Changes

- Add `packages/server` as a thin REST/WS layer implementing a
  `Transport`-compatible API over `execution-core`. No business logic — only
  protocol command/event serialization and deserialization.
- Add browser entry point for `packages/webui` with `FetchTransport`, served by
  that same `server` package.
- Add `webui` diff renderer for this context only (see `shared-ui` design;
  used only when host-native diff UI is unavailable).

## Capabilities

### New Capabilities
- `standalone-app`: standalone web tool (`server` + browser build of `webui`).

### Modified Capabilities
(none)

## Impact

New code: `packages/server/` and standalone browser entry in `packages/webui`
(or separate `packages/standalone` if build wiring needs dedicated config;
decide during apply).