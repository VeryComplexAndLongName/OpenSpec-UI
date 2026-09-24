## Why

Reported by the owner on 2026-09-23: in the Pipeline, pressing Logs on a
change's card does nothing.

It does something, out of sight. Reproduced live on 2026-09-24 against this
repository in the standalone, 1400 by 900:

- The logs open **beneath the picture**, not where the press was. The view
  brings itself into view with `block: "nearest"`, which for a panel below
  the window stops at the window's bottom edge: 82 pixels of it showed,
  the heading and the Close button, and nothing of what the logs say.
- What it did show said "Reading the logs..." for four to five seconds,
  although the read itself answers in 5 ms. The board's own reads take
  that long (`overview` 7.2 s, `change-stages` 5.3 s, `main-drift` 5.0 s,
  `change-standings` 3.8 s, measured one at a time), and a browser sends
  six requests to one origin at once; the logs wait their turn.

A strip at the bottom of the window that says "Reading" is, to a person
looking at the card they pressed, nothing happening.

## What Changes

- The logs open **over the board**, as a panel along the right side of
  the window, whatever the board's height and wherever it is scrolled.
  The board stays where it was underneath.
- The panel takes the focus when it opens, Escape closes it as Close
  does, and the focus goes back to the Logs button that opened it.
- Both hosts draw the same view, so both get this.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `standalone-app` - where a change's run logs open.

## Impact

- `packages/webui/src/components/RunLogsView.tsx` and its stylesheet in
  `shell-ui.ts`, with the view's test. The view finds the button to
  refocus itself, so neither entry point changes.
- One requirement in `openspec/specs/standalone-app/spec.md`; the
  extension's requirement already says it shows the same view.

## Explicitly out of scope

- **The board's slow reads.** They are why the logs wait their turn, and
  they are worth a change of their own: making the logs faster by
  starving the board would trade one wait for another. Here the panel is
  in view from the press on, so a wait is seen as a wait.
