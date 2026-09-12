Nine pictures are listed as hand-taken because "no agent can drive the
editor's own views or capture its window". Measured 2026-09-12, that is
false: Playwright drives Electron, VS Code is Electron, and both are
already here. Launch, wait for `.monaco-workbench`, screenshot, and
screenshot again with a mask — all four work against the binary in
`.vscode-test/`.

## 1. The fixture

- [x] 1.1 A fixture workspace with fixed contents: the changes,
  archives, specs and templates the nine pictures show.
- [x] 1.2 Its directory name is fixed and carries no account name. The
  editor shows the workspace in its title bar and Explorer root, so this
  is cheaper than masking it afterwards.
- [x] 1.3 Not this repository, ever. A picture taken against live
  contents changes when the work changes rather than when the screen
  does.

## 2. Taking them

- [x] 2.1 A spec that launches the downloaded VS Code through
  `_electron.launch()`, with the extension installed and the fixture
  open.
- [x] 2.2 A window of a stated size, so two runs differ only where the
  product does.
- [x] 2.3 Waits on selectors, never on a duration.
- [ ] 2.4 Opens a view by running its command rather than by clicking a
  path through menus. The workbench DOM is not a public API; selecting
  as little as possible is the mitigation.
- [x] 2.5 The nine, at their existing paths, so `README.md` and the
  extension's README keep working untouched.
  All nine, captured 2026-09-12. Three needed a context menu, which was
  the part most likely to resist, and it did not.
  The title bar reads `[Extension Development Host]`. Raised and **left
  alone on the owner's decision**: what matters is that a picture shows
  what its caption claims, not that the window chrome is cosmetically
  perfect.
- [ ] 2.8 The captions are checked against the pictures they now carry,
  and corrected where they have fallen behind.
  Found while doing 2.5: `archive-actions.png`'s caption promised four
  actions — "unarchive, copy template, rollback, and delete" — and the
  menu has **ten**. Show Change Timeline, Reveal in Change Graph, Show
  What This Change Follows, Show What This Change Cost, Explain Harness
  Settings and Recommend a Harness Configuration all arrived since it
  was written. Not false, and six capabilities a reader was never told
  about. Corrected. The other eight captions want the same treatment now
  that there are fresh pictures to check them against.
- [ ] 2.7 Each capture asserts the claim its caption makes before it
  fires. `packages/extension/README.md` says what each picture shows —
  "completed checklist items nested under a change Tasks artifact", "the
  Specs tree listing capabilities and their requirement counts" — and a
  capture that fires without that on screen produces a caption the
  picture does not support. Truthfulness is the whole point; the
  assertion is what makes it a property rather than a hope.
- [x] 2.6 ~~Regions carrying the machine are masked with `mask` /
  `maskColor`, not cropped.~~ **Nothing needs masking, and the fixture
  is why.** The standalone captures mask two path fields because their
  fixture sits under a temporary path carrying the account name; a fixed
  workspace name keeps the title bar and the Explorer root clean in the
  first place. Tried and removed: a grey rectangle across the top of the
  editor reads as a rendering fault, which is worse than what it hid.
  Verified in the captured picture — the title bar reads
  `openspec-workbench` and nothing else.

## 3. Where it runs

- [x] 3.1 Its own command, beside the standalone browser suite. It
  downloads and launches an editor, and `npm run test` has to stay
  something a person runs between edits.
- [x] 3.2 Windows only, and said so. A second platform is a second set
  of pictures that would drift apart.

## 4. The baseline

- [x] 4.1 The nine leave `scripts/screenshot-baseline.json`.
- [x] 4.2 The file stays, holding nothing. Deleting the mechanism would
  make the next hand-taken picture legal by silence; an empty baseline
  keeps adding one a visible edit that states its reason.
- [x] 4.3 `editor-native` is retired from `BASELINE_REASONS` — it is the
  reason that turned out not to be one.
- [x] 4.4 `check-screenshots.mjs` handles an empty baseline, and says so
  rather than reporting nothing.

## 5. Tests

- [x] 5.1 The check accepts an empty baseline and still reports a
  picture no spec takes.
- [x] 5.2 The check refuses `editor-native` as a reason.
- [ ] 5.3 The capture spec produces all nine, at the expected paths.
- [ ] 5.4 No picture contains the account name — asserted against the
  fixture's own path, because that is the string that would leak.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`
- [ ] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [x] 6.3 A pending changeset exists. `check(changeset-present)`
- [ ] 6.4 **Delegated to `claude-cli`**: regenerate all nine, and look
  at each. A picture that captured an empty editor, a dialog that had
  not opened yet, or a view still loading is green to every automated
  check and useless to a reader. Evidence: the nine, and what each one
  shows.
