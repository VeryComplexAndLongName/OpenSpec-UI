Reported by the owner on 2026-09-23: Logs on a card does nothing.
Reproduced on 2026-09-24: the view opened beneath the picture, 82 pixels
of it on screen, saying "Reading the logs..." for four seconds.

## 1. Where the logs open

- [x] 1.1 The view is drawn over the board, along the right side of the
  window, whatever the board's height and scroll.
- [x] 1.2 It takes the focus when it opens; Escape closes it as Close
  does.
- [x] 1.3 Closing it gives the focus back to the Logs button that opened
  it, in both hosts.

## 2. Checks

- [x] 2.1 Tests: the view is a dialog that takes the focus, Escape closes
  it, and the button pressed gets the focus back.
- [x] 2.2 Live against this repository, in the standalone and in the
  editor: Logs pressed on a card, and the view seen whole in the window.
  2026-09-24. Standalone at 1400 by 600: the view at x 640, y 0, 760 by
  600, the focus in it; Escape closed it and the focus was on "Logs of
  the-board-remembers-what-was-archived". Before the change, at 1400 by
  900, it had been at y 818 with 82 pixels on screen. Editor, the
  Extension Development Host built from this worktree, Default Dark Modern
  and Default Light Modern: the view 760 by 708 in a 1092 by 708 panel,
  the focus in it, the editor's widget shadow drawn; Escape closed it and
  the focus went back to the Logs button.
- [x] 2.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0, test 0
  (core 1894, server 493, extension 116, webui 665).
- [x] 2.4 The extension's integration suite, and the whole standalone
  browser suite. Integration: 19 passing in a real VS Code host, exit 0.
  Browser: 29 of 29, exit 0.
- [x] 2.5 `openspec validate logs-open-when-asked --strict`, and the merge
  gate locally with `--base origin/main`. Validate: valid. The gate
  refused while 2.5 was open, naming it, and passed once it was ticked.
- [x] 2.6 A changeset: webui, the server and the extension, patch.
