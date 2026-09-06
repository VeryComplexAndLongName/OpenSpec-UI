## Why

Two event kinds never reach any web UI. `isEvent()` in
`packages/core/src/protocol.ts` validates an event arriving over a
transport by switching on `kind`, and its switch has no case for
`"cancelling"` or `"usageReported"`. Both fall through to
`default: return false`.

The consequences are silent in both delivery targets:

- `packages/webui/src/transport/message-bridge-transport.ts` gates on
  `isEvent(v.event)`, so the VS Code webview **discards** them.
- `packages/webui/src/transport/fetch-transport.ts` calls
  `deserializeEvent`, which throws for them, inside a `catch {}` that
  conservatively ignores anything unrecognized — so the standalone app
  **discards** them too.

Nothing logs, nothing fails, nothing tells the user. The features built
on those events are inert over both transports:

- `cancelling` (shipped in `cancel-reports-what-happened`) is what makes
  a surface say "Cancelling..." instead of pretending a run ended. That
  is the exact complaint the change was written to answer, and
  `AiPanel.tsx`'s `isCancelling()` has never once seen its event.
- `usageReported` (shipped in `usage-from-acp`) carries what an agent
  said it spent. `describeUsage()` renders it and has never been reached.

The audit-log path is unaffected — `agent-runner.ts` consumes the event
in-process, never through a transport — so the recorded usage and the
budget ceiling work. Only the display was silently cut.

The defect is structural, not a typo: `isEvent`'s `default` clause means
adding a member to `EventKind` and to the `Event` union compiles cleanly
while leaving the guard behind. Two kinds have already gone through that
gap, one after the other.

## What Changes

- `packages/core/src/protocol.ts`: `isEvent()` recognizes `"cancelling"`
  and `"usageReported"`, validating each one's own required field.
- A test that fails to **compile** when a future kind is added without a
  guard case, rather than one that has to be remembered. A
  `Record<EventKind, Event>` of samples is exhaustive by type; the
  runtime assertion then walks it.

## Capabilities

### Modified Capabilities

- `execution-core`: every event kind the protocol defines survives a
  transport, so a surface receives what the core emitted.

## Impact

- `packages/core/src/protocol.ts`, `packages/core/src/protocol.test.ts`.
- No transport, adapter or UI file changes: both transports already do
  the right thing with an event the guard accepts.

## Explicitly out of scope

- Removing the `default` clause from `isEvent`. The function takes
  `unknown` from an external transport, and an unknown `kind` must return
  `false` rather than throw. The exhaustiveness has to come from the
  test, which is what this change adds.
- Rendering usage anywhere new. `usage-visible-while-running` covers
  that, and depends on this fix to receive the event at all.
