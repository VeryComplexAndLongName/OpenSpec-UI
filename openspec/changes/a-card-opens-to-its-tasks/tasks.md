A card opens to its tasks; its size, the columns' stacking and zoom are
derived rather than measured (ADR 0029, ADR 0025 amendment).

## 1. Sections and task rows in core

- [x] 1.1 `parseChecklist` in `packages/core/src/task-checklist.ts` records
  a `section` on each item: the text of the nearest `## ` heading above the
  item, with any leading number such as `1.` removed. An item before any
  heading gets no section. Existing callers see the new field and nothing
  else changes for them.

  Done. A `## ` line starts a section, and a `### ` line does not.
  Two existing tests compared whole items under a `## 1. Verification`
  heading and now expect that section too. Nothing else changed for a
  caller: the extension's `changes-tree` test (14) and the cli's
  `status-command` test (19) pass unchanged.
- [x] 1.2 `SurveyedChange` in `packages/core/src/worktree-survey-facts.ts`
  gains
  `tasks: { number?: string; text: string; section?: string; done: boolean; closedBy: "agent" | "person" | "named-agent"; agent?: string }[]`.
  `surveyChanges` in `worktree-survey.ts` fills it from the items it
  already reads. `closedBy` is `person` for a Human-only item and
  `named-agent` (with `agent`) for a delegated item.

  Done, as the exported `SurveyedTask`. The field is optional, as the
  other task-list facts beside it are: it is absent where a change has no
  task list, or the list could not be read. A row's text is the item's
  text without its number.
- [x] 1.3 A pure `describeTaskRows(tasks, inHand)` in
  `packages/core/src/change-card.ts` returns each row's state word from a
  closed set: `done`, `in hand`, `probably next`, `open`,
  `only a person can close it`, `delegated to <agent>`. At most one row is
  `in hand` or `probably next`, and it is the row the card's task in hand
  or guess names.

  Done: `TaskRowWord` is the closed set. The first open row numbered as
  the card's task says `in hand`, or `probably next` for a guess. A done
  row says done even where a record still names it. A row in hand says so
  even when only a person or a named agent may close it, since the run is
  on it.
- [x] 1.4 core tests: `task-checklist.test.ts` for sections (numbered
  heading, unnumbered heading, items before any heading);
  `worktree-survey.test.ts` for the rows and `closedBy`;
  `change-card.test.ts` for each row word and the single in-hand row.

  Done:
  - `task-checklist` passes, 31 tests, with a numbered heading, an
    unnumbered heading, a third-level heading and an item before any
    heading;
  - `worktree-survey` passes, 27, with every row, its section and each
    `closedBy`;
  - `change-card` passes, 27. Its `describeTaskRows` tests cover every
    word, the guess, a repeated number and a done row.

## 2. Heights and layout

- [x] 2.1 `PIPELINE_CARD_REM` in `packages/core/src/pipeline-card.ts` gains
  `taskRow` and `sectionRow`. A new
  `pipelineOpenCardHeight(taskCount: number, sectionCount: number): number`
  returns `NODE_HEIGHT` plus those rows, in layout units.

  Done: `taskRow` is 1 rem and `sectionRow` 1.25 rem.
- [x] 2.2 `layoutChanges(report, options?: { heights?: ReadonlyMap<string, number> })`
  in `packages/core/src/change-layout.ts`:
  - gives each node its own `height`, defaulting to `NODE_HEIGHT`;
  - places each column's nodes by the running sum of heights and
    `ROW_GAP`, in the existing name order;
  - computes the picture's height from those nodes.

  Done. The options type is exported as `ChangeLayoutOptions`. A height
  below `NODE_HEIGHT` is taken as `NODE_HEIGHT`.
- [x] 2.3 Every edge attaches at `node.y + NODE_HEIGHT / 2` at both ends,
  for neighbouring columns and for lane detours alike.

  Done: both routes take their ends from one `headOf`.
- [x] 2.4 core `change-layout.test.ts`:
  - with no heights given, the existing grid tests pass unchanged;
  - with one open card, the cards below it in its column move down by
    exactly its extra height, and no card in another column moves;
  - an edge into an open card attaches at the card's head.

  Done: the file passes, 19 tests, and the 17 that were there are
  unchanged.
- [x] 2.5 core `pipeline-card.test.ts`: the open height for 0 tasks is
  `NODE_HEIGHT`; the open height for 3 tasks under 1 section is
  `NODE_HEIGHT` plus exactly three task rows and one section row.

  Done: the file passes, 9 tests. Core typechecks.

## 3. The open card

- [x] 3.1 In `packages/webui/src/components/PipelineView.tsx`, local and
  foreign cards are no longer a single `<button>`. Each card is
  `role="group"`, labelled by its name. The name is a button that opens the
  change where the host allows it. A disclosure button, `Show tasks` or
  `Hide tasks`, carries `aria-expanded` and `aria-controls`. Do not nest one
  button inside another.

  Done. A local card was already a group with its name as a button, since
  a-change-is-run-from-its-card. Its first line now holds the name and,
  where the change has tasks, the disclosure button. The button's name is
  `Show tasks of <change>` or `Hide tasks of <change>`, and
  `aria-controls` names the list, which stays in the page while it is
  hidden.
  - A foreign card stays a `div` whose name is text, since no host may open
    another directory's change (ADR 0026). Its one control is the same
    disclosure.
  - The browser spec's check that a foreign directory offers no button now
    leaves that control out.
- [x] 3.2 Opening a card passes `pipelineOpenCardHeight` for it into
  `layoutChanges`. The open card lists its tasks in `tasks.md` order, under
  their sections, as an `<ol>`. Each row shows its number, its state word
  and its text on one line, ends with an ellipsis if too long, and keeps the
  full text in `title`.

  Done. Each section is a heading line and an `<ol>` of its rows, and rows
  before any heading form a list with no heading. A row's text leaves out
  a `**Human-only**` or `**Delegated to <agent>**` lead, which its word
  already says. The card's closed part keeps the detail budget of a closed
  card, so opening it changes nothing it says. `ChangeCard` gained `tasks`,
  the rows with their words, from core.
- [x] 3.3 A thin rail joins each row to the next row inside the card. The
  rail is `aria-hidden`. The `in hand` or `probably next` row stands out in
  words and in weight, not by colour alone.

  Done: the rail is an `aria-hidden` span on every row but a section's
  last. The row in hand is bold and says `in hand` or `probably next`.
- [x] 3.4 When the picture has an edge or an open card, a legend above it
  says three things: a solid line means waits for; a thin line inside a card
  means listed next in tasks.md; a collision is written on the card.

  Done: one legend for the tab, above every picture, when any picture has
  an edge or any card is open. The first capture had one above each
  directory's picture, and three identical legends in a row read as noise
  (5.2).
- [x] 3.5 `Open all` and `Close all` buttons above the picture.

  Done: Open all opens every card with tasks, here and in every other
  working directory. Close all is disabled while nothing is open.
- [x] 3.6 `packages/webui/src/shell-ui.ts` writes the row sizes from
  `PIPELINE_CARD_REM`, and `pipeline-card-style.test.ts` pins `taskRow` and
  `sectionRow`.

  Done: the file passes, 5 tests. It also pins the head line and the zoom
  on the picture's unit.
- [x] 3.7 At phone width, an open card lists its rows in its lane, with no
  fixed height.

  Done: below 720px the head line, each heading and each row lose their
  fixed height and wrap. The browser spec's phone-width test opens a card
  and finds no line of any card cut, and the page still does not scroll
  sideways.

## 4. Zoom and memory

- [x] 4.1 The picture's container sets `--pipeline-zoom`. `--u` and every
  card type size in `shell-ui.ts` multiply by it. `Zoom out`, `Zoom in` and
  `Reset zoom` step through 0.75, 0.9, 1, 1.25 and 1.5, and the current
  factor is stated as a percentage.

  Done. The view's root sets the factor, so every picture on the tab zooms
  together. Every vertical length core counts on a card is multiplied by
  it as well as every type size: padding, border, each line and row, and
  the controls. A zoom therefore keeps a card's whole lines whole.
- [x] 4.2 `PipelineViewProps.viewState?: { read(): PipelineViewMemory | undefined; write(memory: PipelineViewMemory): void }`
  holds the zoom and the open cards, keyed by directory path and change
  name.
  - `packages/webui/src/standalone-entry.tsx` passes an implementation over
    `localStorage`, with every read and write in `try`/`catch`.
  - `packages/webui/src/pipeline-entry.tsx` passes one over the webview
    API's `getState` and `setState`.

  Done. The view also guards both calls, and reads a stored value field by
  field. A zoom that is not one of the steps, or an entry that is not a
  directory and a name, is ignored. The editor keeps the memory under
  `pipelineView` beside whatever else its webview state holds.
- [x] 4.3 webui `PipelineView.test.tsx`:
  - opening a card moves the cards below it by its extra height;
  - the legend appears once a card is open;
  - zoom changes `--pipeline-zoom` and no layout unit;
  - a card remembered as open is open after a remount;
  - a `viewState` that throws leaves the view working, with default zoom
    and no open card.

  Done: "a card opens to its tasks" has five tests, these and Open all
  with Close all. The first also checks the rows' words, both headings, a
  marker left out of a row's text, and the toggle's name and state. The
  file passes, 47 tests; webui typechecks and lint is clean.

## 5. Browser suite and pictures

- [x] 5.1 `e2e/pipeline.spec.ts` opens a card and checks:
  - every task row ends inside the card's inner edge (the existing
    `cutLines` check, extended to rows);
  - the cards below the open card moved;
  - the tab passes axe at WCAG AA with the card open;
  - at 150% zoom, no drawn line of any card is cut.

  Done: "opens a card to its tasks, and cuts no line at any zoom" checks
  each of these, and also that a card in another column did not move.
  `cutLinesIn` is now one helper for every test, and counts headings and
  rows. The file passes, 4 tests, against a client built from this branch.
- [x] 5.2 Regenerate `docs/images/standalone/pipeline.png` with one card
  open, and look at it.

  Done: the picture is taken by 5.1's test with `pipeline-first` open.
  Looked at twice.
  - The first capture showed the same legend above each of three pictures,
    so the legend became one for the tab (3.4).
  - The second shows one legend. The open card draws its `Tasks` heading
    and its row whole, below its Start. The card beneath it in its column
    moved down, and `pipeline-second`, in the next column, did not.
  - A row with nothing listed after it draws no rail. The rail is visible
    only on a card with two rows or more, which this fixture has none of.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`

  Done: `openspec validate a-card-opens-to-its-tasks --strict` reports the
  change valid.
- [ ] 6.2 Run `npm run verify` unpiped, after the last edit, with
  everything staged. Record the run and the per-package test counts.
- [x] 6.3 A pending changeset exists: core and webui minor, extension
  patch. `check(changeset-present)`

  Done: `.changeset/a-card-opens-to-its-tasks.md` names
  `@openspec-ui/core` and `@openspec-ui/webui` minor, and
  `openspec-ui-vscode` patch.
- [ ] 6.4 Run the whole browser suite, not a selected spec.
- [ ] 6.5 **Delegated to claude-cli**: look at
  `docs/images/standalone/pipeline.png`, and at the tab at 150% zoom, and
  say whether three things read as intended: an open card, its rail and its
  in-hand row; the legend; and the columns once a card is open. Automated
  checks prove lines are whole and accessible, not that the picture is
  legible at a glance.

  The owner delegated this item to claude-cli on 2026-09-14; it was
  written for a person.

  Where and how:
  - Work in this working directory, on the branch
    `implement-a-card-opens-to-its-tasks`. Do not touch
    `C:\Prog\OpenSpec-UI` or any other checkout.
  - Take every step in a foreground command. A command sent to the
    background ends the run with nothing recorded.
  - Port 4817 is taken by the server that started this run. Use another
    port.
  - The fixture in the picture has one task per card, so it shows no rail
    and no row in hand. Also look at a scratch repository under the
    system's temp directory, with a change of several tasks under two
    headings and a run record that names one of them. Change no tracked
    file except this task list.
  - Say what you looked at, and for each of the three things whether it
    reads as intended and why. Where one does not, say what a reader would
    misread, and leave the item open.
