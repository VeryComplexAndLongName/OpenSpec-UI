## Why

Asked by the owner on 2026-09-24, from a user's first look at the
Pipeline: the user is about to name every change `<CHANGE number>-<title>`,
and the Pipeline has no sorting at all.

Within a column the cards stood in the order of their names compared as
strings. That order is invisible and nobody chose it, and for numbered
names it is wrong: "change-10" comes before "change-2". A person who
numbers their changes to find them faster would find the column out of
order the day they reach ten.

## What Changes

- **Names read as a person reads them.** Digits in a name compare as
  numbers and case is set aside, so "CHANGE-2" stands before
  "change-10". This is the default order, in both arrangements and in the
  other working directories' pictures.
- **A Sort control** beside the arrangement, with three orders:
  - **Name**, as above;
  - **Progress**, the change furthest along first: the one nearly done is
    the one worth finishing;
  - **Recently changed**, the change worked on last first: the later of
    its task list's last change and its last run's end, or the day it was
    archived. A task list counts because a change worked on by hand has no
    run at all.
  A card without the fact an order compares goes after the cards that
  have it, in name order; so does every tie.
- The order sorts the cards **within** each column. The columns stay what
  they are, a change's step or its stage.
- The choice is kept with the zoom and the arrangement, per viewer.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - the order a column's cards stand in, and a control for it.

## Impact

- `packages/core/src/change-order.ts` (new): the orders, the comparison,
  the facts a card gives it, and a rank for a layout. Browser-safe.
- `packages/core/src/change-layout.ts`: a column is stacked by a rank
  where one is given, and in name order read as numbers otherwise.
- `packages/webui/src/components/PipelineView.tsx` and `shell-ui.ts`: the
  control, the kept choice, and the rank passed to every picture.
- One requirement in `openspec/specs/shared-ui/spec.md`.

## Explicitly out of scope

- **Sorting by stage or state.** A column already is a stage on the board,
  and a step in the other arrangement.
- **A direction toggle.** Each order has the direction a person reaches
  for; a reversed one has not been asked for.
