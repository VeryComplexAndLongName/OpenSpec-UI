## Why

On 2026-09-17 the owner looked at the Pipeline and said: "the cards and the
buttons are poor. Could they be done in the Metro UI style? Proper headings,
proper states. The buttons are pitiful. On the whole, not in the style of
the application."

The rest of the shell has moved to the project site's look under ADR 0033;
the Pipeline still draws a card as a small box with a coloured left edge, its
state as an uppercase word, every fact as a grey line of the same weight, and
its controls as the browser's default buttons squeezed into a 20-pixel row.
Nothing on a card stands out: not what the change is doing, not how far it
has got, not what a person can do about it.

A mockup was drawn for it (<https://claude.ai/artifact/79UGq85vxFKSiGGofi8md8>),
in light and dark, and the owner approved it: "I like all of it."

## What Changes

- **A card is a Metro card.** The change's name as its heading, beside the
  control that shows its tasks; its state as a coloured badge that still
  carries the word; how far its tasks have got as a bar with "9 / 22 tasks";
  a run's stage beside the badge.
- **What a card says is a list of facts, each with an icon for its kind**:
  the task in hand, what the run is doing, whose run it is, where the facts
  were read, what it waits on, what it can start alongside, a collision, how
  the last run ended.
- **A run waiting for an answer says so in a callout**, above the facts.
- **A card's controls are the site's buttons**, in a footer: the next step
  filled (Start, Continue to verify, Allow), Stop and Stop now outlined in red,
  the rest outlined. A run this host started says "started here".
- **An open card lists its tasks as rows**: the number, the task, and a tag
  in words ("Done", "In hand", "Probably next", "Open", "A person", or the
  agent's id), under the list's headings.
- **Each column is headed** "Step 1 · can start now", "Step 2 · after step 1".
- **The screen is laid out in panels**: a toolbar that says which branch was
  read and when, with Open all, Close all, the zoom and Refresh; "Changes in
  this checkout"; "Worth doing"; "Other working directories".
- **A card's height follows what it holds, derived in core** (ADR 0025): the
  state row, the bar, a callout, up to four facts, the footer, and an open
  card's rows. Nothing is measured. Facts past four stay on the card for
  assistive technology and in its title, counted on the last line drawn.
- **Cards are wider and the gap between columns narrower**, so three columns
  of names fit the width the shell has.
- **The thin line inside an open card goes**: rows in a bordered list are read
  in order, and the legend speaks only of the line between cards.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: how a card states its state and progress, what its size is
  derived from, how an open card names each task, and which lines the legend
  explains.

## Impact

- **`packages/core`**: `pipeline-card.ts` (a card's lengths, and its height
  from what it holds), `change-layout.ts` (card width, column gap, the row a
  column's heading takes, where a line meets a card, a column's heading),
  `change-card.ts` (each fact's kind, and the note beside the badge), with
  their tests.
- **`packages/webui`**: `PipelineView.tsx`, `HintList.tsx`, the Pipeline's
  styles in `shell-ui.ts` and their test, `PipelineView.test.tsx`.
- **`packages/server/e2e`**: `pipeline.spec.ts`, and the pictures it takes.
- The editor's Pipeline panel draws the same view.
- No payload, protocol or reading changes.
