Asked for by the owner on 2026-09-20, after a fresh working directory
showed three active changes with nothing to say about which of them was
its own.

## 1. The reading, in core

- [x] 1.1 `packages/core/src/change-ownership.ts` says, for one change and
  one survey, whether it is worked `here`, `elsewhere`, by somebody whose
  record is `unverified`, or by `nobody`.
- [x] 1.1a A directory also works a change when its branch bears that
  change's name and the change is present there. The survey's own pairing
  holds only while the change is active on the default branch (ADR 0029),
  so a change proposed this morning would read as nobody's on the morning
  the question matters most. Found by looking at this repository rather
  than by a test.
- [x] 1.2 An `elsewhere` answer carries the directory's label and path, its
  branch where it has one, and the person where a verified record names
  one.
- [x] 1.3 An `unverified` answer names the directory and no person: a
  record that fails its signature is evidence of nothing.
- [x] 1.4 A change active in this checkout that no directory is the
  worktree of reads `nobody`, not `elsewhere`.
- [x] 1.5 The words a row shows come from core too, so the tree and the
  standalone list cannot word it differently. A change nobody has taken up
  prints no caption: in a repository worked in one directory every row
  would otherwise carry the same words, and a caption every row carries is
  not read.
- [x] 1.6 A test covers each of the four answers, and the case of a survey
  that could not be taken (every change reads `nobody`, and nothing
  throws).

## 2. The Changes tree says it

- [x] 2.1 This directory's own change is drawn first, and the view's
  description names it.
- [x] 2.2 An `elsewhere` or `unverified` row is drawn `lock` in
  `disabledForeground`, with the directory and person in its description
  and the whole sentence in its tooltip.
- [x] 2.3 A `nobody` row keeps its state icon, its colour and its menu: it
  is free to pick up.
- [x] 2.4 Where this checkout has no change of its own, the empty row says
  so and says how many are being worked in other directories, with a press
  that opens the Pipeline.
- [x] 2.5 The rows redraw on the same events the standings already redraw
  on: no new watcher, no new git call.

## 3. Nothing that would write, on somebody else's row

- [x] 3.1 The mutating per-change menu items are hidden on an `elsewhere`
  or `unverified` row, by `contextValue`. Reading it stays offered, and so
  does speaking to the run in it: the message channel is how two agents
  are meant to coordinate (ADR 0028), so `sayToRun` and `stopRunAfterTask`
  are shown, not hidden.
- [x] 3.2 Each of those commands also refuses when invoked by name -
  palette, keybinding, another extension - and says which directory to
  work in instead. A row that carries no ownership - the change graph's,
  or a Pipeline card naming a change by its id - is allowed: refusing on a
  fact the row does not carry would refuse at random.
- [x] 3.3 A test invokes one of them by name on another directory's change
  and asserts the refusal and that nothing was written.

## 4. Reading another directory's copy

- [x] 4.1 A `TextDocumentContentProvider` on this extension's own scheme
  serves `proposal.md`, `design.md` and `tasks.md` from another
  directory's working copy, read-only by construction.
- [x] 4.2 The editor's title reads the change, the directory and
  `read-only`. A text document's tab is named by its URI's last segment
  and by nothing else, so the sentence is that segment.
- [x] 4.3 A press opens the directory itself in a new window.
- [x] 4.4 A file that is not there, or a directory that cannot be read,
  opens as a one-line explanation rather than an error toast.

## 5. Moving between them

- [x] 5.1 A command lists every active change in a QuickPick with where it
  is worked and whose it is, and reveals the chosen one in the tree.
- [x] 5.2 The picker puts this directory's change first.

## 6. The standalone list says the same

- [x] 6.1 `ChangesList` shows the same four answers, from the same core
  function.
- [x] 6.2 Its tests cover a change worked elsewhere and one taken up by
  nobody.

## 7. Checks

- [x] 7.1 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`. The one failure is
  `packages/webui/scripts/build-metro-icons.test.mjs`, which fails on
  Windows for its line endings and fails the same way on untouched `main`.
- [x] 7.2 A changeset: the extension and the standalone app both change.
- [x] 7.3 `openspec validate changes-shows-one-change-and-who-owns-it
  --strict`.
- [x] 7.4 The editor captures still pass:
  `npm run test:pictures -w openspec-ui-vscode` - 17 passed.
- [x] 7.5 **Human-only.** Done by Claude on 2026-09-20 at the owner's
  request, for the owner to look at in turn. The reading was run against
  this repository as it actually stands, from
  `C:/Prog/.worktrees/OpenSpec-UI/changes-shows-one-change-and-who-owns-it`,
  and printed:

  - the view's description: `changes-shows-one-change-and-who-owns-it`;
  - `changes-shows-one-change-and-who-owns-it` - `here`, ordinary;
  - `an-agent-says-where-it-is-working` - `elsewhere`, locked, "worked in
    an-agent-says-where-it-is-working";
  - `a-run-budget-has-a-unit` - `nobody`, ordinary, no caption;
  - the pointer row: "1 change is worked in other working directories, and
    not in this one", naming
    `the-homepage-hears-about-an-article (the-homepage-hears-about-an-article)`.

  That look is what found 1.1a. What it does not cover is the drawing
  itself in a running editor - the icons, the menus that are hidden, and
  the read-only tab - which is covered by the unit tests and by the 17
  editor captures, and which the owner can see at a glance by opening this
  working directory.
