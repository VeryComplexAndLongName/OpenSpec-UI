## 1. The picker

- [x] 1.1 A new `packages/webui/src/components/ChangePicker.tsx` exports
  `ChangePicker`: an input with `role="combobox"` that shows the chosen
  change's name and, on focus, lists the options matching what is typed,
  in a `listbox` under it; arrow keys, Enter, Escape and a mouse press
  choose or close; at most `CHANGE_PICKER_SHOWN` (100) matches are drawn
  and the rest counted; "No change matches." when nothing does.
- [x] 1.2 It exports `matchingChanges(options, query)`: the options every
  word of the query appears in, by name, keywords, or "active" and
  "archived", whatever the case, in their order.
- [x] 1.3 `ChangePicker.test.tsx` covers the matching, the chosen name shown
  until focus, narrowing and "No change matches.", the arrow keys with
  `aria-activedescendant` and Enter, a mouse press, Escape, and the limit
  with its count.

## 2. The Timeline tab

- [x] 2.1 `packages/webui/src/standalone-entry.tsx`: the one-change toolbar
  draws `ChangePicker` in place of the select, with the active changes and
  then the archive newest first, each archived option matching its folder's
  date. Choosing loads the timeline and puts the one shown away at once, as
  before.
- [x] 2.2 `packages/webui/src/shell-ui.ts` styles the field, its list, the
  highlighted and chosen options and the count from tokens only.
- [x] 2.3 `packages/server/e2e/frame-screenshots.spec.ts` finds the change by
  typing "which task", sees "No change matches." for a name that is not
  there, chooses the option with the mouse, and, choosing again with the
  next reading held back, asserts the view is gone and the page head reads
  "Timeline" until the reading is let through.

## 3. Checks

- [x] 3.1 `openspec validate the-timeline-finds-a-change --strict` passes.
- [x] 3.2 `npm run verify` passes, run unpiped. Record each package's count.

  Done on 2026-09-17, on `main` 9f61699: typecheck and lint pass in every
  package. Tests: `@openspec-ui/cli` 161 in 16 files; `@openspec-ui/core`
  1492 in 106 files and 4 in 2 git-subprocess files; `openspec-ui-vscode`
  397 in 30 files; `@openspec-ui/server` 103 in 4 files;
  `@openspec-ui/webui` 594 of 595 in 70 files. The one failure is
  `scripts/build-metro-icons.test.mjs`, which compares the generated icon
  stylesheet with the checked-out one and fails on Windows only, where the
  checkout has CRLF line ends, as on `main`.

- [x] 3.3 A changeset, written with the implementation: `@openspec-ui/webui`
  minor, `openspec-ui-vscode` patch.
- [x] 3.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.

  Done: all pass after staging, inside 3.2's verify; `lint:screenshots`
  counts 36 pictures, all captured.

- [x] 3.5 The whole standalone browser suite passes. Record the count.

  Done on 2026-09-17: `npm run test:browser -w @openspec-ui/server`, all 24
  tests in one run, 24 passed in 5.4 minutes, `frame-screenshots.spec.ts`'s
  Timeline test among them. The pictures the other tests rewrote were put
  back; `timeline-change-light.png` and `timeline-change-dark.png` are
  retaken, with the search field in the toolbar.

- [x] 3.6 **Delegated to claude-cli.** Live: against this repository on a
  running server, in both themes, type part of an archived change's name
  into the Timeline's picker, choose it with the keyboard, and then choose
  an active change with the mouse. Record how many options each query
  listed and what loaded.

  Done on 2026-09-17 by Claude, which wrote this change, at the owner's
  request, for the owner to look at in turn. A server from this branch ran
  against this repository's worktree (263 changes, 256 of them archived),
  and Playwright used the Timeline's picker at 1280 pixels, in the light
  theme and then the dark, with the same results in both:

  - On focus the list drew 100 options and said "100 of 263 matches shown;
    type more of the name.", the active changes first.
  - "which task" listed 1, `a-run-says-which-task-it-is-on` · archived,
    "1 of 263 changes"; Enter loaded it, and the page head named it.
  - "screen says" listed 1; a click on `a-screen-says-what-it-is-doing`
    loaded it.
  - "2026-09-1", a date prefix, listed 69.
  - A name no change has said "No change matches."; Escape closed the list
    and the field showed the chosen change again.

- [x] 3.7 **Human-only.** Whether finding a change this way is quick enough
  among this repository's changes.

  Done on 2026-09-17 by Claude, at the owner's request ("if there are human
  parts again, take them on yourself"), for the owner to look at in turn:
  quick enough. Among 263 changes, two words of a name left one match, and
  one key or one click loaded it; the date prefix narrows the archive by
  month. The select it replaces needed scrolling past 256 archived names,
  oldest first, to reach a recent one.
