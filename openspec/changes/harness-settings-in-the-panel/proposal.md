# Harness settings are edited in VS Code, not typed into JSON

## Why

`Configure Harness` and `Configure Harness for this Change` open the
configuration file in the editor. Everything the settings surface knows
is missing from that experience:

- which effort values the chosen agent actually accepts, out of seven
  that exist and are agent-specific,
- which spending field it honours — `maxCostUsd` or `maxAiCredits`, never
  both,
- which custom agents this workspace defines, which the standalone shell
  now offers per stage and VS Code cannot offer at all,
- which of the configured ceilings cannot act, which is the diagnostic
  this project built after shipping three configurations that were valid
  and did nothing.

None of that is in the file, and a person hand-editing JSON is doing the
validator's job from memory. The standalone shell has rendered all of it
for months, from components in `webui`, and the extension already hosts
`webui` in a panel — which, since `run-dialog-in-the-panel`, already
renders one of those components.

## Capabilities

### Modified

- The harness configuration is edited in both hosts through the same
  settings view, with the same pickers and the same diagnostics.

### New

- The webview can ask the extension host for something and get an answer,
  rather than only sending commands and receiving a stream of events.

## Out of scope

The first-run wizard (`Set Up Agentic Harness`). It asks a short ordered
set of questions once, which is what a wizard is for; this change is
about the surface a person returns to.

Removing the file. It is still the configuration, it is still
hand-editable, and both commands still name it — the view is a way to
edit it, not a replacement for it.
