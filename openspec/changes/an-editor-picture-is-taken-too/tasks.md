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
- [ ] 2.5 The nine, at their existing paths, so `README.md` and the
  extension's README keep working untouched.
  **Two of nine done**: `overview-expanded.png` and
  `overview-compact.png`, which are the two the READMEs lead with. The
  remaining seven need a view driven into a particular state — an open
  context menu for `archive-actions` and `template-actions`, an expanded
  task tree for `nested-tasks`, a spec open in the editor for
  `specs-editor` — and a context menu is the part of this that a version
  bump is most likely to move.
  One blemish to settle before the rest: the title bar reads
  `[Extension Development Host]`, which is true of how the picture is
  taken and not of the product a reader installs.
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

- [ ] 4.1 The nine leave `scripts/screenshot-baseline.json`.
- [ ] 4.2 The file stays, holding nothing. Deleting the mechanism would
  make the next hand-taken picture legal by silence; an empty baseline
  keeps adding one a visible edit that states its reason.
- [ ] 4.3 `editor-native` is retired from `BASELINE_REASONS` — it is the
  reason that turned out not to be one.
- [ ] 4.4 `check-screenshots.mjs` handles an empty baseline, and says so
  rather than reporting nothing.

## 5. Tests

- [ ] 5.1 The check accepts an empty baseline and still reports a
  picture no spec takes.
- [ ] 5.2 The check refuses `editor-native` as a reason.
- [ ] 5.3 The capture spec produces all nine, at the expected paths.
- [ ] 5.4 No picture contains the account name — asserted against the
  fixture's own path, because that is the string that would leak.

## 6. Verification

- [ ] 6.1 This change validates strictly. `check(validate-change)`
- [ ] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 6.3 A pending changeset exists. `check(changeset-present)`
- [ ] 6.4 **Delegated to `claude-cli`**: regenerate all nine, and look
  at each. A picture that captured an empty editor, a dialog that had
  not opened yet, or a view still loading is green to every automated
  check and useless to a reader. Evidence: the nine, and what each one
  shows.
