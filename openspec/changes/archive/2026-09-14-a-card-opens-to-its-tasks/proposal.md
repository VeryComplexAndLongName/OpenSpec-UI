# A card opens to its tasks

## Why

ADR 0029 makes three decisions about a card's tasks:

- A card opens to list its tasks, and every line in the picture says what
  it means.
- A card's size is derived from what the card shows, which amends
  ADR 0025's fixed size.
- Zoom is one factor that multiplies the unit.

None of this can be drawn today:

- **A card has a fixed size.** `layoutChanges` places every node at
  `NODE_HEIGHT`, with a uniform row pitch
  (`y = row * (NODE_HEIGHT + ROW_GAP)`), and four tests pin that grid. The
  stylesheet gives a card a fixed height with `overflow: hidden`.
- **A card is one `<button>`.** Per-task content cannot be put inside it,
  and every task's text would become part of the button's accessible name.
- **The task list has no sections.** `readTaskChecklist` returns items
  without their headings and without nesting, and nothing in core reads
  the `## 1. …` headings of `tasks.md`.
- **The survey carries only counts.** A card knows how many tasks are
  done, but not which ones.

## Capabilities

### New

- Core reads the sections of `tasks.md`, so every item knows its heading.
- A card opens to list its tasks under their headings. Each task carries
  its state in words: done, in hand, probably next, open, only a person can
  close it, or delegated to a named agent.
- A thin line inside a card joins each task to the task listed after it. A
  legend says what the thin line means and what the solid line between
  cards means.
- Core derives an open card's height from its rows. Each column stacks its
  cards by height, and an edge attaches at the head of a card.
- Zoom in, zoom out and reset, as one factor. Open all and close all. Each
  viewer's zoom and open cards are remembered.

### Modified

- `layoutChanges` takes the height of each open card and returns each
  node's own height.
- The survey carries each change's task rows as well as its counts.
- A card is a group of controls rather than one button: its name opens the
  change, and a disclosure opens its tasks.
- "A card shows only whole lines of its text" applies to a closed card. An
  open card is tall enough to draw every row whole.

## Impact

- `packages/core`: `task-checklist.ts` (sections), `worktree-survey.ts` and
  its facts (task rows), `pipeline-card.ts` (row tokens and open height),
  `change-layout.ts` (heights and stacking), `change-card.ts` (row states).
- `packages/webui`: `PipelineView` (the disclosure, the rows, the rail, the
  legend, zoom and memory) and `shell-ui.ts` (the row tokens and the zoom
  factor).
- `packages/extension`: the pipeline entry remembers the view through the
  webview's own state.
- ADR 0025's amendment, dated 2026-09-13, is what this change implements.

## Out of scope

- Dependencies between tasks. `tasks.md` has no way to declare one (ADR
  0029).
- Acting on a task from its row: ticking it, running it, or delegating it.
- Controls on a card beyond the disclosure. Those belong to
  `a-change-is-run-from-its-card`.
