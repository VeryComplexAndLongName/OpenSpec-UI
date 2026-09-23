## Why

Reported by the owner on 2026-09-23: no kanban happens at all - pressing
"By step" and "By stage" changes nothing. Reproduced the same hour
against his own checkout, and he is right.

The board shipped on 2026-09-22 (`the-board-shows-the-stages`) and does
draw six columns - when there is anything to draw. What happens otherwise
was never thought through:

- **The board is not drawn at all where nothing stands on it.** The view
  answers an empty report with "No active changes" or "Nothing to draw
  here", and the arrangement never reaches the layout. Pressing "By
  stage" then changes nothing on screen, which is indistinguishable from
  a control that does not work.
- **The board folds away what landed.** The other arrangement hides
  landed changes behind a "2 changes have landed / Show them" row, which
  is right where landing is not a place. On a board Landed *is* a column,
  so the fold empties it by construction - and on the owner's checkout it
  emptied the whole board, because both changes there had landed.
- **An empty board says nothing about why.** "Nothing to draw here" is
  not an answer to "where did my board go".

The owner's rule, given the same day: every column must be shown whether
or not anything is in it. That is what a board is for - the way through is
the point, not the cards that happen to be on it today.

On the same screen, the other thing he reported: a card saying **"also in
OpenSpec-UI"**. That is not the product's name being used as one - it is
the main checkout's label, which is the name of the folder the repository
was cloned into. It happens to read as a product.

## What Changes

- The board is drawn whenever it is chosen, with every column, headed and
  empty, and says why it is empty when it is.
- The board does not fold what landed: a landed change stands in the
  Landed column. The fold stays in the other arrangement, where it
  belongs.
- An empty board has room to be seen: the layout gives it at least the
  heading strip and a card's worth beneath, instead of collapsing to
  nothing.
- A card naming another directory that holds the same change calls the
  main checkout **the main working directory**. Its own heading keeps its
  own label.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - what the board draws when nothing is on it, and what a
  card calls the main checkout.

## Impact

- `packages/webui/src/components/PipelineView.tsx` and its tests.
- `packages/core/src/change-layout.ts` and its tests.
- Two requirements in `openspec/specs/shared-ui/spec.md`.

## Explicitly out of scope

- **Putting the other working directories' cards on the board.** They are
  drawn in their own section today, read-only and never acted on from
  here, and a change is one card wherever it is worked (ADR 0029). Making
  the board span directories is a design question of its own, not a
  defect to fix in passing.
- **Dragging a card between columns.** A change moves itself when its
  conditions are met (ADR 0037 decision 7). Nothing here changes that.
