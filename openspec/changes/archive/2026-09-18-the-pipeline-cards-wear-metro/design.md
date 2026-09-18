## Context

`PipelineView` draws core's layout: every card is absolutely positioned at
coordinates `layoutChanges` returned, in `rem`, with the SVG of the edges in
the same units (ADR 0025). A card is `NODE_WIDTH` 16 by `NODE_HEIGHT` 5,
taller only while open. What fits on it is arithmetic over
`PIPELINE_CARD_REM`, and `pipeline-card-style.test.ts` holds the stylesheet
to those lengths. The browser suite checks that no drawn line ends below its
card at 100% and at 150%.

A card's words come from core: `describeChangeCard` gives the state word and
a list of lines; the view adds what readiness says (waiting on, alongside, a
collision, a worktree, a git author).

The mockup draws a card as the site does: a white box with a hairline border
and a small shadow, the name bold, a badge, a progress bar, facts with icons,
a footer of buttons.

## Goals / Non-Goals

**Goals:**

- The Pipeline looks like the approved mockup in both themes and in the
  editor's panel.
- Every guarantee the picture makes stays: positions and heights derived,
  never measured; no line drawn in part at any zoom; every fact on the card
  for assistive technology; state in words, not colour alone.

**Non-Goals:**

- Changing what is read, when, or what a card offers to do.
- A column heading that says more than its place in the order.
- The Pipeline's narrow view beyond keeping it working: cards stack in
  headed lanes, as today.

## Decisions

### A card's height is derived from what it holds

ADR 0025 rejected measuring. A fixed height, though, cannot hold a badge, a
bar, several facts and a footer without either wasting room on a quiet card
or cutting a busy one. So core derives each card's height from counts the
view already knows before drawing: whether it has a state row, a bar, a
callout, how many facts it draws (at most `PIPELINE_CARD_DETAIL_LINES`, 4),
whether it has controls, and, open, how many rows and headings.

`pipelineCardHeight(parts)` adds the lengths in `PIPELINE_CARD_REM`, and the
view passes every card's height to `layoutChanges`, which already stacks a
column by the heights it is given. The stylesheet is written from the same
table, and its test reads it.

| Part | rem | Drawn as |
| --- | --- | --- |
| border, top and bottom | 0.0625 each | 1 px hairline |
| above the heading | 0.75 | padding |
| heading row | 1.75 | name, and the 28 px tasks control |
| state row | 1.625 | 0.375 gap, 1.25 badge row |
| progress row | 1.875 | 0.75 gap, 1.125 bar and count |
| callout | 3.25 | 0.75 gap, 2.5 box with one line |
| facts | 0.75 + 1.5 each | gap, then one line each |
| open rows | 0.75 + 0.125 + 1.75 each | gap, list border, row or heading |
| footer | 3.6875 | 0.75 gap, border, 0.5 + 1.875 + 0.5 |
| without a footer | 0.875 | padding |

A closed card with nothing but its heading, badge and bar is 7 rem, which is
`NODE_HEIGHT`.

Every line is one line with an ellipsis, as today. A wrapped line would make
the height depend on the font, which nothing knows without measuring. The
card's `title` holds every fact whole.

### Wider cards, narrower gaps, a heading per column

`NODE_WIDTH` becomes 21 and `COLUMN_GAP` 3.5: a change name of this project's
usual length fits, and three columns take 70 rem, inside the shell's 1180
pixels. `layoutChanges` starts every column `LANE_HEADING` (2) rem down, and
the view draws each column's heading in that strip, from
`describeLane(column)`: "Step 1 · can start now", "Step 2 · after step 1".
A line between cards meets a card at `CARD_HEAD`, the middle of its heading
row, 1.6875 rem below its top, whatever the card holds below.

### Each fact has a kind, from core

`describeChangeCard` keeps `lines` (every fact as text, for the title and for
callers that read text) and adds `details`: the same facts with a kind
(`task`, `waiting`, `activity`, `whose`, `stop`, `tasks`, `last-run`,
`where`), and `note`, the run's stage, drawn beside the badge. The "N of M
tasks done" fact is the bar's count; its `tasks` detail says only what a
person or another agent must close, and is absent when nothing is. The view's
readiness facts get kinds of their own (`waiting-on`, `alongside`,
`collision`, `worktree`, `where`, `whose`). The view picks an icon per kind;
the icon is decoration (`aria-hidden`), and the words carry the fact.

### State in a badge, in words

The badge is the state word core gives, in a colour that agrees with it:
running cobalt, waiting amber, failed crimson, blocked mauve, ready steel,
done emerald, stopped crimson outlined. A card waiting on a person also has
an amber border. The word is never replaced by the colour.

### Controls by what they do

The same buttons, test ids and accessible names as today, in a footer. The
button that moves the change forward (Start, Continue to …, Allow) is filled
cobalt; Stop, Stop now and Deny are outlined crimson; Copy folder path is
outlined grey. Icons inside buttons are `aria-hidden`, so a button's name is
unchanged.

### Tasks as rows with a tag

An open card lists rows in a bordered list: the number, the task, and a tag.
The tag is the row's word, shortened where it would not fit a tag: "only a
person can close it" is drawn "A person", "delegated to claude-cli" is drawn
"claude-cli". The row keeps its whole word for assistive technology and in
its title. The thin rail between rows goes: in a bordered list the order is
the order, and the legend now explains only the line between cards, and that
a collision is written, not drawn.

### Panels

The reading line, the read-at line and the view's controls become one
toolbar. The picture is inside a "Changes in this checkout" panel; the hints
inside "Worth doing", each with the command and a Copy button where the host
can copy; the other directories inside "Other working directories". Test ids
stay.

## Risks / Trade-offs

- **A taller card moves more.** A column of busy cards is longer than before.
  It is the same stacking the open card already used, and the facts cap at
  four.
- **The narrow view.** Below 720 pixels cards stop being positioned, as
  today, and take their natural height; the lane headings are shown there
  already.
- **The editor's theme tokens.** The badge colours use the shell's tokens,
  which the editor maps to its chart colours, so they follow its theme.
