## Why

A specific gap found in review of this repository: `packages/extension/CHANGELOG.md`
stops at `0.4.3`, but `packages/extension/package.json` is already at
`0.8.0` — the `0.5.0` (`standalone-shell-host-aware-tabs`), `0.6.0`
(`archive-tasks-as-template`), `0.7.0` (`agent-selection`), and `0.8.0`
(`template-catalog`) releases have no changelog entries at all. This is
the marketplace-facing changelog (`readme.md`'s sibling in the packaged
`.vsix`) — users updating the extension currently see no explanation for
four consecutive version bumps.

## What Changes

- Add the missing `0.5.0`–`0.8.0` entries to `packages/extension/CHANGELOG.md`,
  each summarizing what actually shipped in that OpenSpec change (per
  `docs/adr/`... no, per each change's own `proposal.md - What Changes`),
  matching the existing entries' terse, user-facing style.
- Update `README.md`'s package version table (`@openspec-ui/core`,
  `openspec-ui-vscode`, `@openspec-ui/server`, `@openspec-ui/webui`),
  which is also stale (predates even the two changes archived before this
  session).
- No source code changes — this is documentation only.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — pure documentation, no behavior change; `.openspec.yaml` sets
`skip_specs: true` accordingly)

## Impact

- `packages/extension/CHANGELOG.md`, `README.md`.
