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
- [x] 5.2 `npm run verify` passes, run unpiped. Record each package's count.
  Do not pipe it: a pipe reports the pipe's exit code.
- [x] 5.3 A changeset: `@openspec-ui/webui` minor, `openspec-ui-vscode` minor,
  and `@openspec-ui/core` patch for 6.3.
- [x] 5.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.
- [x] 5.5 The whole standalone browser suite passes. Record the spec count.

  Record, 2026-09-17, for 5.2, 5.4 and 5.5: `openspec validate --strict`
  valid. `npm run verify`, unpiped, after the last code edit: typecheck and
  lint pass in every workspace; tests — root scripts 4 + 11 + 10 + 9 + 4,
  extension 390, core 1488 of 1489, server 101 of 103, and cli and webui
  ended by vitest's worker pool failing ("Maximum call stack size exceeded"
  in tinypool), with the processor at 100% from processes outside this work.
  Each was run again on its own: server 103; core's `successor-check.test.ts`,
  the one core failure (a 20-second timeout), 10 of 10; cli 160 of 161, and
  its one failure, `release-manifest.test.ts` (a 30-second timeout reading
  the repository's history), 19 of 19 alone; webui with two workers 570 of
  571. The one webui failure is `scripts/build-metro-icons.test.mjs`, the
  known Windows line-ending comparison of the generated icon module, which
  passes on Linux CI and is untouched here. `lint:english` (after `git add`),
  `lint:changesets`, `lint:test-budgets`, `lint:source-text` and
  `lint:screenshots` pass. The whole standalone browser suite: 23 of 23
  passed.

- [x] 5.6 **Delegated to claude-cli.** The acceptance this change exists for:
  with `openspec-ui.transport.localServer.enabled` on, start a harness chain in
  the Extension Development Host, open the Pipeline panel while the chain's
  `apply` stage runs, and read the cards. Evidence to record: the text of one
  card at two moments during the run, the absence of any "did not reply within
  10 seconds" message, and the screenshot path. Then repeat with the setting
  off, to show the old path still works and still times out the same way.

  Done on 2026-09-17 by Claude, at the owner's request, in the Extension
  Development Host built from this branch (VS Code 1.137.0, Default Dark
  Modern), driven by Playwright. The workspace was a throwaway repository
  with a `slow-change` whose tasks each wait 25 seconds, run by
  claude-cli-acp with haiku, autonomous. Each chain was started from the
  card's Start, through the run dialog's chain path, inside the panel. The
  card was read when it first showed `apply`, and again 30 seconds later.
  Pictures and logs are kept outside the repository.
  - **Server on, machine idle.** "READY probably task 1.1: Use Bash to run
    exactly … running apply — said 15s ago", then "RUNNING on task 1.1: …, by
    its own account … PowerShell: node -e … — said 24s ago". No "did not
    reply within" line anywhere in the panel.
  - **Server off, machine idle.** "RUNNING probably task 1.1: … running apply
    — said 2s ago", then "RUNNING on task 1.1: …, by its own account …
    PowerShell: node -e … — said 13s ago". No timeout line either: an idle
    machine does not reproduce the report this change answers.
  - **Server off, every core busy** (one busy worker per logical core, eight,
    for 150 seconds from the chain's start). "RUNNING probably task 1.1: …
    running apply", said 1s ago and then 31s ago, and the panel said "the
    host did not reply within 10 seconds to pipeline/readiness" and "The
    other working directories could not be read: the host did not reply
    within 10 seconds to pipeline/survey". The old path times out as before.
  - **Server on, every core busy.** "READY probably task 1.1: … running apply",
    said 0s ago and then 33s ago, and no timeout line. The card answered, and
    said Ready above its own "running apply": 6.3.
  - **Server on, every core busy, after 6.3.** "RUNNING probably task 1.1: …
    running apply — said 3s ago", then "… — said 38s ago". No timeout line;
    opening the card landed on `proposal.md`; Stop was asked from the card.

- [x] 5.7 **Human-only.** Whether the embedded Pipeline feels like part of the
  editor: the theme, the scrolling, and whether opening a change from a card
  lands where it should.

  Done on 2026-09-17 by Claude, at the owner's request, in the same host with
  the local server on, in Default Dark Modern and Default Light Modern. The
  first look found two faults, fixed by 6.1 and 6.2, and the second look
  found neither.
  - **Theme.** The embedded Pipeline was light in a dark editor: it followed
    the operating system. Afterwards the frame's address carried `theme=dark`
    in the dark editor and `theme=light` in the light one, and the Pipeline
    was drawn in each.
  - **Scrolling.** The iframe sat at the browser's default 300 by 150 pixels
    in the tab's corner; once it filled the tab, the outer document added a
    scroll bar of its own. Afterwards the page was 1092 pixels wide with 1092
    pixels of content, nothing wider, and the Pipeline was the only thing
    that scrolled.
  - **Opening a change.** The card's name opened `slow-change`'s
    `proposal.md` in the editor and revealed the change in the Changes tree,
    in every run of 5.6, with the server on and off.

## 6. What the live check found

- [x] 6.1 `packages/extension/src/webview/embedded-page.ts` gives both panels
  `editorThemeName()` and `frameFillingStyle(nonce)`. `PipelinePanel` and
  `AiPanel` set `theme=` on the iframe's URL and allow the outer document's
  stylesheet by a nonce; the stylesheet makes the iframe a block that fills
  the panel, and the outer document unscrollable. `PipelinePanel` frames the
  page again on `onDidChangeActiveColorTheme`.
- [x] 6.2 `packages/webui/src/host-embed.ts` exports `embedTheme(search)`.
  `useStandaloneTheme` in `packages/webui/src/standalone-theme.ts` takes a
  theme it is told over a stored choice and the system, and
  `standalone-entry.tsx` tells it the embed's.
- [x] 6.3 `standingRunsOf` in `packages/core/src/worktree-survey-facts.ts` is
  the filter `readChangeStandings` uses for a copy's runs.
  `describeChangeCards` gives each read standing's copies the runs of the
  survey its run lines come from, by `standingRunsOf`, and keeps everything
  else the standing read.
- [x] 6.4 Tests: `pipeline-panel.test.ts` (the theme in the URL, the page
  framed again when the theme changes, the stylesheet's nonce),
  `ai-panel.test.ts` (the theme in the URL, the stylesheet's nonce),
  `host-embed.test.ts` (`embedTheme`), `standalone-theme.test.tsx` (a theme it
  is told), and `change-card.test.ts` (Running from the survey's runs over a
  standing read before the run; a copy the survey does not list keeps its
  runs). The first `change-card.test.ts` test fails without 6.3.
