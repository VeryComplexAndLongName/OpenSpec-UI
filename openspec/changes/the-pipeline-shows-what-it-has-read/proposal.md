# The Pipeline shows what it has read

## Why

Two things showed in the Pipeline tab on 2026-09-13, both while
`what-the-others-are-doing` was checked with a real second agent.

- **The other working directories vanished while this one was being
  read.** The survey of the other directories had come back, with the
  second agent's run in it, and the tab still showed only "Reading what
  is running…". `PipelineView` returns early until this directory's own
  report arrives, and returns early again with only an error if that
  report fails. What had been read was hidden because something else had
  not been.
- **A card cut its text through the middle of a line.** A card has a
  fixed size (ADR 0025). `what-the-others-are-doing` stopped a card's
  name being squeezed out by clipping its details from the bottom
  instead, and on a card with more detail than room the last visible line
  is now sliced horizontally. ADR 0025 says text longer than a card "is
  truncated with the full text available on the element"; half a line is
  not truncation, and it reads as a rendering fault.

## What Changes

- **Each reading is shown when it arrives.** The other working
  directories are drawn whether this directory's reading is still being
  taken, has arrived, or has failed. The loading note and the error take
  the place of this directory's picture, not of the whole tab.
- **A card shows only whole lines.** How many lines a card holds is
  derived from its size, as its position already is — not measured in
  the browser. Lines past that stay on the card for assistive technology
  and in its title, are not drawn, and the card shows that there is more.

## Impact

- `packages/core` — the layout's neighbour says how many detail lines a
  card of a given height holds, from named size tokens.
- `packages/webui` — `PipelineView` (independent readings; the line
  budget on local and foreign cards) and `shell-ui.ts` (the tokens, and
  single-line details with an ellipsis).
- ADR 0025 stands: fixed size, derived rather than measured. This makes
  its "truncated" mean whole lines.

## Out of scope

- The Pipeline as the place a change is run — the VS Code tab, a change
  as an object, start and stop — which gets its own ADR and changes.
