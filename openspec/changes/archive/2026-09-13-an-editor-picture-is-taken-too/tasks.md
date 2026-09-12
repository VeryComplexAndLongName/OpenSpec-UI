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
- [x] 2.4 ~~Opens a view by running its command rather than by clicking a
  path through menus.~~ **Not done as written, deliberately.** Views are
  opened by clicking the activity-bar entry, pane headers and tree rows —
  no path through menus, which was the fragility this item named. What
  kept the pictures honest was not the route into a view but what each
  capture waits for before firing: rows only the extension's own tree can
  produce, a heading the editor has tokenised, a status bar with nothing
  still activating. Running commands instead would have removed a click
  and none of the four wrong pictures this change found.
- [x] 2.5 The nine, at their existing paths, so `README.md` and the
  extension's README keep working untouched.
  All nine, captured 2026-09-12. Three needed a context menu, which was
  the part most likely to resist, and it did not.
  The title bar reads `[Extension Development Host]`. Raised and **left
  alone on the owner's decision**: what matters is that a picture shows
  what its caption claims, not that the window chrome is cosmetically
  perfect.
- [x] 2.8 The captions are checked against the pictures they now carry,
  and corrected where they have fallen behind.
  2026-09-12, all nine, each picture looked at beside its caption in
  `packages/extension/README.md`:
  - `repository-setup.png` — **was false.** The caption names three
    generators; the picture showed the Repository Setup row with no
    children at all. The capture passed because it waited for
    "CLAUDE.md", which is in the parent row's own description. It now
    waits on each child row by name, and the picture shows all three.
  - `archive-actions.png` — promised four actions; the menu has **ten**.
    Show Change Timeline, Reveal in Change Graph, Show What This Change
    Follows, Show What This Change Cost, Explain Harness Settings and
    Recommend a Harness Configuration arrived after it was written.
    Caption corrected.
  - `overview-expanded.png` — promised "change artifacts" and "processes";
    every change was collapsed and the fixture's Processes view is empty.
    A change is now opened to show its artifacts, and the caption no
    longer claims process entries.
  - `overview-compact.png` — named six views; there are seven. Human-Only
    Inbox added to the caption.
  - `specs-editor.png` — true, but photographed twice mid-activation:
    Markdown uncoloured, status bar reading "Activating Extensions…".
    Now waits for a tokenised heading and checks the status bar last.
  - `template-actions.png` — true; the capture only checked that *a* menu
    opened. Now asserts both named actions.
  - `archive-tasks.png`, `nested-tasks.png`, `specs-list.png` — true as
    captioned.
- [x] 2.7 Each capture asserts the claim its caption makes before it
  fires. `packages/extension/README.md` says what each picture shows —
  "completed checklist items nested under a change Tasks artifact", "the
  Specs tree listing capabilities and their requirement counts" — and a
  capture that fires without that on screen produces a caption the
  picture does not support. Truthfulness is the whole point; the
  assertion is what makes it a property rather than a hope.
  Done for all nine — and it took finding two captures that passed
  without it: one asserted text living in the parent row rather than the
  rows the caption names, one asserted an absence with a check taken
  before the thing could appear. Where a caption names entries, each is
  asserted by name; where it describes a state, the capture waits for
  what produces that state, not for the element that shows up first.
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
- [x] 5.3 The capture spec produces all nine, at the expected paths.
  `npm run test:pictures`: 9 passed. `lint:screenshots`, which finds each
  picture's capture by the path its spec writes, reports 22 pictures, 22
  captured, 0 hand-taken — so a spec that stopped writing one of these
  paths fails the ordinary lint, not only this run.
- [x] 5.4 No picture contains the account name — asserted against the
  fixture's own path, because that is the string that would leak.
  Every capture goes through one `shoot()`, which asserts the rendered
  text of the workbench does not contain `os.userInfo().username` before
  the shutter. Rendered text only: the editor's hidden accessibility
  regions carry full paths nobody sees, and matching those would fail a
  picture that leaks nothing.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`
- [x] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-13, exit 0. Typecheck and lint clean across all five packages,
  including `lint:english`, `lint:source-text`, `lint:changesets`,
  `lint:test-budgets` and `lint:screenshots` — which reports 22 pictures,
  22 captured, 0 listed as hand-taken. Tests: cli 124, core 1133,
  vscode 327, server 84, webui 394 — 2062 across 164 files, 0 failed.
  `npm run test:pictures`: 9 passed.
- [x] 6.3 A pending changeset exists. `check(changeset-present)`
- [x] 6.4 **Delegated to `claude-cli`**: regenerate all nine, and look
  at each. A picture that captured an empty editor, a dialog that had
  not opened yet, or a view still loading is green to every automated
  check and useless to a reader. Evidence: the nine, and what each one
  shows.
  2026-09-13, closed on the owner's instruction, and said so: it was done
  by the agent that wrote the captures, which the marking rule calls a
  rubber stamp. It was not a formality — the first pass, recorded in 2.8,
  found one false picture and three behind their captions, all green.
  Regenerated against `main` at #442: `npm run test:pictures`, 9 passed.
  Each looked at beside its caption — expanded overview shows a change's
  Proposal and Design, the archived change, both specs with "1
  requirement", the template catalogue and the graph; compact overview
  shows all seven views; specs list shows both counts; the spec editor
  shows `spec.md` coloured with a clean status bar; nested tasks show 1.1
  and 1.2 done under Tasks; Repository Setup shows all three generators;
  the archive menu shows all ten actions; the archived tasks sit beside
  that menu; the template menu shows Customize and Insert. None empty,
  none mid-load, none with a dialog not yet open. Three files differed in
  bytes and not in picture, so they were not recommitted.
