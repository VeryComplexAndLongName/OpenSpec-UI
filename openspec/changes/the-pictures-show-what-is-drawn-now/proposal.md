## Why

The owner, on 2026-09-19: new screenshots from everywhere, because the
interface has changed completely, and the documentation around them with
them.

They are right about both halves. Every picture in `docs/images/` is
captured by an end-to-end test - `openspec-workbench`'s "Documentation
screenshots are captured from a running product" has required that since
`every-screenshot-is-taken-by-a-spec`, and
`scripts/check-screenshots.mjs` fails on a picture no capture takes. What
neither says is that the picture in git has to be the one the capture
takes *now*. A suite that regenerates twenty-five files and a person who
restores them because the change they were working on was about something
else leaves the committed pictures exactly as stale as a hand-taken one,
and nothing fails.

That is what happened. The standalone pictures were last committed on
2026-09-18 with the last five tabs; the editor's were last committed on
2026-09-15, before the editor learned to say what blocks a change, before
the Archive, Specs and Change Graph took filters, before the graph folded
what has landed, before a relation could be set from a row, and before
the workspace cleared what it left behind. `packages/extension/README.md`
is the Marketplace's own details page, and every picture on it is from
before all five.

Several screens have no picture at all: the Summary's "Left behind"
panel, a view narrowed by a filter, the graph with its landed branches
folded, the pickers that state a relation.

## What Changes

- **Every picture is taken again**, from the product as it is now, and
  committed with the change that takes them.
- **The screens with no picture get one.** The standalone Summary's
  "Left behind" panel; and in the editor: a filtered view with its
  message, the Change Graph folded with its "landed relations hidden"
  row, the relation pickers, and the Changes view saying what the sweep
  cleared.
- **The documents that carry them are read against what they now show.**
  `README.md`, `packages/extension/README.md` (the Marketplace details
  page), `packages/server/README.md`, and the how-to that shows a run
  being stopped: alt text and prose that describe a screen that has since
  changed are corrected.
- **The spec says the picture belongs to the change.** A change that
  redraws a screen commits the picture of it, rather than leaving the
  next change to notice.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-workbench`: a captured picture is retaken and committed by the
  change that redraws its screen.

## Impact

- **`docs/images/standalone`** and **`docs/images/extension`**: every
  picture rewritten, and new ones added.
- **`packages/server/e2e`** and **`packages/extension/e2e`**: captures for
  the screens that have none.
- **`README.md`, `packages/extension/README.md`,
  `packages/server/README.md`, `docs/how-to/stop-a-run.md`**: what the
  pictures are said to show.
- No package behaviour changes, so no changeset.
