# Tell the 0.40 to 0.43 story, with pictures that are real

## Why

Four releases went out between 0.40.0 and 0.43.0 and the only account of
them is a changelog, which lists what changed and never says why any of
it mattered. The last article covered 0.37.3 to 0.40; this covers what
came after.

The pictures are the point of doing it here rather than by hand. This
repository already captures its documentation screenshots from a real
running standalone UI in an end-to-end test — server up, workspace
created, a real chain driven to a checkpoint. So a screenshot in this
article is a screenshot of software that ran, in CI, on the commit it
illustrates. A hand-taken one goes stale silently.

Two of the images this article needs already exist and one is already
wrong: `harness-change-override.png` predates the per-change template
picker, so the current file shows a screen that no longer exists.

## Capabilities

### Modified

- The captured documentation screenshots cover what a run now shows
  before it starts.

### New

- An article covering 0.40.0 to 0.43.0.

## Out of scope

Screenshots of the VS Code surfaces — the context menu, the Run
quick-pick, the command palette. Playwright drives a browser, not an
editor, so those cannot be captured this way, and a hand-taken picture of
them would be exactly the kind that goes stale without anyone noticing.
The article is written to stand without them.
