## Context

`AiPanel` (`packages/extension/src/webview/ai-panel.ts`) is the
extension's only existing webview, built specifically around
`RunController` and the streaming `Command`/`Event` agent-run protocol,
delivered over an in-process message bridge (ADR-0001's primary mode).
Every other existing per-change detail view (`showChangeDetails`,
`validateChangeStrict`) opens as a plain native
`vscode.workspace.openTextDocument` Markdown document, not a webview —
none of them fit a positioned, styled timeline layout.

## Goals / Non-Goals

**Goals:**
- The extension's default (message-bridge) mode gets the Timeline
  feature without requiring the optional local-server mode
  (`openspec-ui.transport.localServer.enabled`) to be turned on.
- The same `ChangeTimelineView` component renders identically whether
  data arrived via a real REST fetch (standalone) or was embedded
  directly by the extension host (VS Code) — one component, two hosts,
  per this repository's shared-UI convention.
- Opening timelines for different changes yields separate tabs a user
  can compare side by side (not a single panel that gets overwritten).

**Non-Goals:**
- Not extending `AiPanel`/`DashboardContext` with a "timeline mode"
  field — considered and rejected (see Decisions): a one-shot render of
  already-fetched data has nothing to gain from `AiPanel`'s streaming
  machinery, and coupling an unrelated feature to it would only add
  risk to a component that already works.
- Not adding "timeline" to `ALLOWED_TABS_VSCODE_EMBED` — the dedicated
  extension webview path (`TimelineWebviewPanel`) already serves the VS
  Code case without needing the optional local-server iframe embed.
- Not building the multi-change parallel view here — that is
  `2026-08-26-add-multi-change-timeline-view` (next), reusing this
  change's data layer and `ChangeTimelineView` where it can.

## Decisions

### A new, purpose-built webview instead of extending `AiPanel`

The extension host already imports `@openspec-ui/core` directly
(ADR-0001), so `getChangeTimeline` can be called in-process — no REST,
no message bridge round trip needed at all. Given that, a brand new
`TimelineWebviewPanel` with a minimal HTML shell is simpler than
threading a new field through `AiPanelContext`/`reveal()`/the
`openspec-ui/context` message type: no new message type, no listener
changes in `extension-entry.tsx`, and no risk to the existing,
well-tested `AiPanel` message loop.

### Data is embedded in the initial HTML, not posted as a follow-up message

`AiPanel`'s existing `detectAndPostAgents()` posts a follow-up context
message *after* an async operation (`detectAvailableAgents()`, which
takes long enough in practice that the webview has already loaded).
`getChangeTimeline` has no equivalent built-in delay, so posting it as
a follow-up message risks a real race: the webview's own message
listener might not be attached yet when the extension host posts.
Embedding the already-computed JSON directly in the initial HTML (as
`window.__OPENSPEC_UI_TIMELINE__`, JSON-stringified with `<` escaped to
`<` to prevent an embedded `</script>` sequence — e.g. inside
proposal markdown — from closing the script tag early) sidesteps the
race entirely; `timeline-entry.tsx` reads it synchronously at startup.

### Not a singleton panel

Unlike `AiPanel` (one "OpenSpec UI" panel, `reveal()`d again for a new
context), `TimelineWebviewPanel.show()` creates a new
`vscode.window.createWebviewPanel` every call — matching the user's own
framing ("opens in a tab") and letting multiple changes' timelines stay
open side by side for comparison, which also anticipates Phase 2's
multi-change view.

## Risks / Trade-offs

- **[Risk]** This development machine's `npm run test:integration`
  (a real VS Code Extension Development Host via `@vscode/test-electron`)
  fails with a pre-existing, reproduced, environment-specific error
  (`Cannot find module <temp-workspace-path>`, unrelated to this
  change — the same issue documented in
  `2026-08-26-signal-run-completion`'s tasks.md, still reproducing
  identically against unmodified `main`). → **Mitigation**: verified the
  actual built `dist/timeline.js` bundle instead, in a real Chromium
  browser (Playwright) loading real data from this repository's own
  archived changes (via a direct `getChangeTimeline` call, the same
  data path the extension host uses) — confirmed correct rendering,
  correct task count/dates, and zero console errors. This exercises the
  real bundle and the real component tree, though not VS Code's own
  webview/CSP integration specifically.
