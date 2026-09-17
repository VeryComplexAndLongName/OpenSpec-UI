The Pipeline panel answers while a chain runs, by taking its readings from the
optional local server's process instead of the editor's. Raised by the owner on
2026-09-16, from a panel that went dark during a harness run.

## 1. The embedded shell can show the Pipeline tab

- [x] 1.1 `ALLOWED_TABS_VSCODE_EMBED` in `packages/webui/src/host-embed.ts`
  becomes `["run-a-command", "pipeline"]`.
- [x] 1.2 `packages/webui/src/host-embed.test.ts` asserts the embed shows
  exactly those two tabs, in `ALL_TABS` order, and that a plain browser tab
  still shows all nine.
- [x] 1.3 `packages/webui/src/host-embed.ts` exports `initialTab(search,
  visibleTabs)`, returning the tab a `tab=` parameter names when it is visible
  and the first visible tab otherwise.
- [x] 1.4 `packages/webui/src/standalone-entry.tsx` opens on `initialTab`'s
  answer instead of the first visible tab. It does not change which tabs are
  visible.
- [x] 1.5 `packages/webui/src/host-embed.test.ts` covers `tab=` naming a hidden
  tab, an unknown tab, and no parameter at all.

## 2. The panel serves the server's page when the server is enabled

- [x] 2.1 `PipelinePanelDeps` in
  `packages/extension/src/webview/pipeline-panel.ts` gains
  `getLocalServerUrl(): string | undefined`, and `packages/extension/src/extension.ts`
  passes `OptionalServerManager`'s URL through it.
- [x] 2.2 `PipelinePanel.show()` renders an iframe at
  `<url>/?embed=vscode-local-server&tab=pipeline` under the CSP
  `default-src 'none'; frame-src <url>;` when that dependency answers a URL.
- [x] 2.3 With `undefined`, the same method renders today's `pipeline.js`
  bundle and the bridge, unchanged.
- [x] 2.4 `packages/extension/src/webview/pipeline-panel.test.ts` asserts both
  branches by the HTML each produces, and that the panel never starts the
  server itself.

## 3. A card's actions still work from the embed

- [x] 3.1 `packages/webui/src/standalone-entry.tsx` posts
  `openspec-ui/open-change` to `window.parent` when a card is opened and the
  page is embedded, and does nothing of the sort when it is not.
- [x] 3.2 `packages/extension/src/webview/pipeline-panel.ts` forwards that
  message to `revealChange` only when `event.origin` equals the local server's
  origin.
- [x] 3.3 `packages/extension/src/webview/pipeline-panel.test.ts` asserts a
  message from another origin is ignored, and one from the server's origin
  reaches `revealChange`.
- [x] 3.4 A test in `packages/webui/src/components/PipelineView.test.tsx`
  asserts Stop in the embedded page calls `/api/runs/ask-to-stop`, and that the
  panel forwards no stop request of its own.

## 4. The setting says what it now covers

- [x] 4.1 `openspec-ui.transport.localServer.enabled`'s description in
  `packages/extension/package.json` names the Pipeline panel as well as the AI
  panel.
- [x] 4.2 `packages/extension/README.md`'s transport section says the same, and
  says what a person gets from it: cards that answer while a run works.

## 5. Checks

- [x] 5.1 `openspec validate the-pipeline-answers-while-a-run-works --strict`
  passes.
- [ ] 5.2 `npm run verify` passes, run unpiped. Record each package's count.
  Do not pipe it: a pipe reports the pipe's exit code.
- [x] 5.3 A changeset: `@openspec-ui/webui` minor, `openspec-ui-vscode` minor.
- [ ] 5.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.
- [ ] 5.5 The whole standalone browser suite passes. Record the spec count.
- [ ] 5.6 **Delegated to claude-cli.** The acceptance this change exists for:
  with `openspec-ui.transport.localServer.enabled` on, start a harness chain in
  the Extension Development Host, open the Pipeline panel while the chain's
  `apply` stage runs, and read the cards. Evidence to record: the text of one
  card at two moments during the run, the absence of any "did not reply within
  10 seconds" message, and the screenshot path. Then repeat with the setting
  off, to show the old path still works and still times out the same way.
- [ ] 5.7 **Human-only.** Whether the embedded Pipeline feels like part of the
  editor: the theme, the scrolling, and whether opening a change from a card
  lands where it should.
