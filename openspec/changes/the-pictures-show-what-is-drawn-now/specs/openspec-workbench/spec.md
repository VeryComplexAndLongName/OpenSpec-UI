## MODIFIED Requirements

### Requirement: Documentation screenshots are captured from a running product

A screenshot used in this repository's documentation SHALL be captured
from the running standalone UI by an end-to-end test, not taken by hand.

A hand-taken screenshot goes stale silently: the screen changes, the
picture does not, and nothing fails. One captured by a test fails when the
element it waits for is gone, so a screen that changed is reported rather
than quietly misrepresented.

A picture that a capture takes is not fresh by being captured: it is
fresh by being committed after the screen last changed. A change that
redraws a screen SHALL commit the picture its capture then produces,
rather than restoring the picture that was there. A capture suite
rewrites every picture it takes, and discarding that output leaves the
committed picture exactly as stale as a hand-taken one, with nothing to
say so.

This applies to the extension's documentation as well as the standalone
application's. A screen that is the shared web UI rendered inside a
webview is not an editor surface: it is reachable from the browser and
SHALL be captured there, whichever host a reader sees it in.

Where a surface cannot be driven this way — the editor's own tree views,
menus and quick-picks are not reachable from a browser — documentation
SHALL be written to stand without a picture of it, or SHALL carry one
that is explicitly listed as hand-taken, with the reason and the date it
was taken. An unlisted hand-taken picture SHALL NOT be used: the defect
is not that a picture was taken by hand, it is that nobody can tell
which pictures those are.

#### Scenario: A screen changes under a captured screenshot

- **WHEN** a screen a documentation screenshot depends on changes
- **THEN** the capture fails on the element it can no longer find, rather
  than producing a picture of the wrong screen

#### Scenario: A change that redraws a screen

- **WHEN** a change alters what a captured screen draws
- **THEN** that change commits the picture its capture produces, rather
  than restoring the one that was there

#### Scenario: A webview screen documented for the extension

- **WHEN** documentation for the VS Code extension shows a screen that
  the shared web UI renders
- **THEN** the picture is captured from the standalone shell by an
  end-to-end test

#### Scenario: An editor-native surface

- **WHEN** a documented surface is drawn by the editor itself
- **THEN** either the documentation stands without a picture, or the
  picture is listed as hand-taken with its reason and the date it was
  taken
