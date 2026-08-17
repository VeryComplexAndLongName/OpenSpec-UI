## Context

`standalone-entry.tsx` renders five sections top-to-bottom in one scrolling
page: Run a Command (`AiPanel`), Processes and Recovery (`ProcessesView`),
Diff Preview (`ChangeDiff`), OpenSpec view summary (raw overview tables),
Change Editor (tabbed textarea + markdown preview, its own internal
`editorTab` state — unrelated to the page-level tabs this change adds).
`AiPanel.getLocalServerHtml` (`packages/extension/src/webview/ai-panel.ts`)
embeds this same bundle in a VS Code Webview `<iframe>` when
`openspec.transport.localServer.enabled` is on. See `proposal.md - Why` for
the gap this leaves.

## Goals / Non-Goals

**Goals:**
- Give the standalone shell page-level tab navigation for its five
  sections.
- Let the shell distinguish "plain standalone browser" from "VS Code
  local-server embed" at boot, before first paint of the disallowed tabs.
- In the VS Code embed case, show only "Run a Command".

**Non-Goals:**
- No change to `extension-entry.tsx` (the message-bridge Webview entry) —
  it never rendered these five sections and is unaffected.
- No change to which commands/events cross the wire; no protocol change.
- Not a security boundary: the embed signal controls default UI visibility
  only. It does not gate API access (the existing per-server token already
  does that) and is not designed to resist a user manually editing the URL
  in their own browser to unhide tabs (see Risks).
- Not restructuring the Change Editor's own internal tab bar
  (proposal/design/tasks/spec) — that is a separate, existing mechanism
  nested inside the new "Change Editor" page-level tab.

## Decisions

### Signal mechanism: query parameter baked into the iframe `src`, read synchronously at boot

`getLocalServerHtml(baseUrl)` builds `<iframe src="${baseUrl}?embed=vscode-local-server">`
instead of the current `src="${baseUrl}"`. `standalone-entry.tsx` reads
`new URLSearchParams(window.location.search).get("embed")` once at module
init (alongside the existing `readAccessToken()` pattern, which already
reads `window.location.hash` at module init) and derives
`isVsCodeEmbed = embed === "vscode-local-server"` before the first render.

Rejected alternatives:
- **`postMessage` after mount** (extension host tells the iframe its
  context once loaded): rejected because it renders all five tabs first
  and then hides four of them once the message arrives, causing a visible
  flash and an extra render pass. The query-parameter approach is
  synchronous and available before `createRoot(...).render(...)`.
- **Separate bundle/entry point** for the embedded case (e.g.
  `embedded-standalone-entry.tsx` that only ever renders `AiPanel`):
  rejected because it duplicates the tab-shell and section wiring in two
  places that will drift, defeating the reuse `getLocalServerHtml` exists
  for in the first place (ADR-0001 decision #2: local-server mode trades
  lifecycle simplicity for standalone UI *parity* through code reuse, not
  through a maintained fork).
- **VS Code extension setting** (a new `openspec.transport.localServer.tabs`
  config the user sets manually): rejected — this is a fixed structural
  fact about what VS Code already covers natively, not a per-user
  preference; adding a setting would let users recreate the exact
  duplication this change removes.

### Hidden tabs do not mount

When `isVsCodeEmbed` is true, the four disallowed tab panels are not
rendered into the DOM at all (conditional render on the active/allowed tab
set), not merely hidden with CSS. This avoids the Processes/Recovery and
OpenSpec-summary panels firing their data-load effects (`ProcessesView`'s
`api.list()`, `handleLoadOverview()`) inside the embed, which would be
wasted network/API-token traffic for UI the user can never reach there.

Rejected alternative: mount all five, hide four with `display:none` —
simpler, but keeps the redundant data fetches and defeats part of the
motivation (still doing the work the native VS Code panels already do).

### Tab shell: small hand-rolled component, no new dependency

A `Tabs`/`TabPanel` pair added to `packages/webui/src/components/` (or
inlined in `shell-ui.ts` alongside `shellThemeCss`), following the existing
pattern of no UI-kit dependency in this package (current deps: `react`,
`react-dom`, `react-markdown`, `remark-gfm`, `diff`). Rejected pulling in a
tabs library — five static, non-nested tabs do not justify a new
dependency in a package explicitly kept minimal for two build targets.

## Risks / Trade-offs

- **[Risk]** A standalone browser user could append `?embed=vscode-local-server`
  to their own URL and hide four tabs for themselves. → **Mitigation**:
  none needed; this is a self-inflicted UI default with no security or data
  consequence, and reversible by editing the URL back.
- **[Risk]** Existing users who rely on the local-server embed for the
  currently-duplicated Diff Preview, Processes and Recovery, or Change
  Editor (if any use them there today instead of native VS Code UI) lose
  that view inside VS Code. → **Mitigation**: those users already have full
  native equivalents (`vscode.diff`, `processes-tree.ts` +
  `recovery-diagnostics.ts`, `open-doc.ts`) available in the same VS Code
  window; nothing becomes unreachable, only relocated to native UI as
  ADR-0001 decision #6 already intends.
- **[Risk]** Forgetting to update `getLocalServerHtml` if a future change
  adds a sixth standalone section could silently over-expose it in the
  embed. → **Mitigation**: the `standalone-app` spec scenario "VS Code
  local-server embed" pins the requirement to an explicit tab allowlist
  (only "Run a Command"), so a contract/unit test asserting the allowed-tab
  set under the embed signal will fail if a new tab is added without
  updating that set.

## Migration Plan

- No data migration; this is UI-only. `localStorage` keys
  (`openspec-ui:standalone:cwd`/`changeDir`) are unchanged.
- Rollout is a version bump of `@openspec-ui/webui` (tab restructuring,
  backward-compatible) and `@openspec-ui/extension` (iframe `src` now
  carries a query parameter) per `openspec/config.yaml` versioning rules —
  both minor, since existing behavior is preserved in plain standalone and
  the embed narrowing is the intended new behavior, not a breaking one.
- Rollback: revert both package changes together; the query parameter is
  additive and ignored by any shell build that predates this change.
