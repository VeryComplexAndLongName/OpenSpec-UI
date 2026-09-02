## Why

Raised directly in review on 2026-09-01, from repeated daily use: every
time the AI panel opens, the user must click "Load changes" before
anything else in the panel works. Confirmed in
`packages/webui/src/components/AiPanel.tsx:861-868`: the button's only
action is `runCommand("list")`, and the change picker right next to it is
`disabled={availableChanges.length === 0 || isRunning}` — so until that
button is clicked, `availableChanges` is empty and no change can be
selected, which in turn blocks every command that needs a change
(`plan`/`review`/`implement`, all of which call `runCommand` with the
selected change's directory).

That makes "Load changes" not an optional action but an unlabelled
**precondition** for the whole panel, delegated to the user on every
single open. The empty picker gives no hint that a specific button must
be pressed first to populate it — a discoverability dead end, and pure
repeated friction for anyone who uses the panel more than once.

The underlying `list` command is a pure read (`openspec list` via the
existing transport), with no side effects on the repository, so there is
no reason it needs a human to authorize it each time.

## What Changes

- `packages/webui/src/components/AiPanel.tsx`: the panel runs the `list`
  command automatically once, when it first has a usable `cwd`, so the
  change picker is populated on open without any click.
- The button stays, relabelled "Reload changes": with another agent (or
  the user) creating changes on disk while the panel is open, an explicit
  re-read is still needed — but as a refresh, not as a gate.
- No change to what `list` does, to the transport, or to any other
  command's behavior.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `command-output-hub`: the AI panel populates its change picker on open
  instead of requiring a manual "Load changes" click first.

## Impact

- `packages/webui/src/components/AiPanel.tsx`, `AiPanel.test.tsx`.
- No `core`/`server`/`extension` changes — the panel already receives
  `cwd` as a prop and already owns the `list` call.
