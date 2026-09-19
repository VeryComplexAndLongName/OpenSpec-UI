## Why

The owner pressed **Review** in Processes and nothing happened. It was
reported as a dead button, with the suggestion that it might be table
decoration and should be removed.

It is not dead. Reproduced live on 2026-09-19, over this repository's own
workspace: the table held 100 rows, the Review button of the first row sat
at 518 px, and the details panel it filled rendered at **5856 px** - below
every one of the hundred rows. Nothing scrolls to it, the row that was
pressed is not marked, and no message appears. The button answers into a
place the reader cannot see, five screens down.

Two more things make it worse:

- pressing Review on a second row replaces the contents of the same distant
  panel, so even a reader who found it once cannot tell whether a later
  press did anything;
- a hundred rows cannot be narrowed, so finding the run to review is
  already work before the button is pressed.

## What Changes

- **The answer appears where it was asked for.** Pressing Review opens the
  run's details directly under its own row, and pressing it again folds
  them. One row is open at a time.
- **The row says what it is doing.** While the details are being read the
  row says so, and the button carries its open state, so a slow read is not
  silence either.
- **The list can be narrowed**, with the same `matchesFilter` the other
  views use, over the operation, the change name, the agent and the state,
  and it says how many of how many it shows.
- The standing panel below the table goes: it is the place nobody could
  see.

## Capabilities

### Modified Capabilities

- `standalone-app`: persistent process recovery says where the details
  appear and that a press is answered visibly.

## Impact

- `packages/webui/src/components/ProcessesView.tsx` and its test.
- `packages/webui/src/shell-ui.ts` for the row's open state, from tokens.
- `docs/images/standalone/processes.png` is retaken.
- A changeset for `@openspec-ui/webui` and the hosts that bundle it.

## Explicitly out of scope

- **Removing the button**, which was the owner's alternative. It does real
  work: it reads the checkpoint delta, the coverage and whether a rollback
  is possible. What was wrong is where the work was shown.
- Paging the hundred rows. A filter answers the same need without deciding
  for the reader what a page is; if it turns out not to, paging is a change
  of its own.
- The extension's Processes tree, which has no Review and is not what was
  pressed.
