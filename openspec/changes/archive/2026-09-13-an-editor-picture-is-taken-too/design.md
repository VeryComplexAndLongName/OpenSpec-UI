# Design

## Decision: Playwright's Electron support, not screen capture

The rejected route was capturing the screen at the operating system's
level. It fails the rule `every-screenshot-is-taken-by-a-spec` set for
itself: a capture must not publish the machine it was taken on, and a
screen grab takes whatever is on the screen — the account name in a
path, another window, a notification.

`_electron.launch()` gives a real VS Code whose window is a page
Playwright controls. That buys the same masking the standalone captures
already use, the same waiting on selectors instead of on sleeps, and a
window of a fixed size rather than whatever the display happens to be.

Verified before this was written rather than assumed: launch, wait for
`.monaco-workbench`, screenshot, and screenshot again with
`mask`/`maskColor`. All four worked against the binary already in
`.vscode-test/`.

## Decision: a fixture workspace, never this repository

The pictures show changes, archives, specs and templates. Taken against
this repository they would show its real contents — which drift, so the
picture changes when the work changes rather than when the screen does,
and every capture would carry whatever was in flight that day.

A fixture workspace is fixed: the same changes, the same names, the same
counts, so a difference in a picture means a difference in the product.

It also settles the account-name problem more cheaply than masking does.
The standalone captures had to mask paths because the fixture lives in a
temporary directory whose path carries the account name; the editor
shows the workspace name in its title bar and in the Explorer root. A
fixture directory with a fixed name keeps that out of the picture in the
first place, and masking stays for what cannot be arranged away.

## Decision: not part of the ordinary suite

It downloads an editor and launches it. That belongs beside the
standalone browser suite — its own command, run where that one runs —
and not in `npm run test`, which has to stay something a person runs
between edits.

## Decision: the baseline is emptied, not deleted

`scripts/screenshot-baseline.json` stays, holding nothing, and
`check-screenshots.mjs` keeps enforcing that every picture is either
captured by a spec or listed with a reason.

Deleting the mechanism would make the next hand-taken picture legal
again by silence. An empty baseline says the opposite: the exception
exists, nothing is currently using it, and adding one is a visible
edit — which is what `BASELINE_REASONS` was written to force. The
`editor-native` reason itself is retired, because it is the one that
turned out not to be a reason.

## Non-Goals

Capturing the editor on macOS or Linux. The pictures are taken on one
machine and committed; a second platform is a second set of pictures
that would drift apart.

Driving the editor for anything but pictures. The integration suite
already tests behaviour, from inside the extension host, where it
belongs.

Screenshots of a live workspace. See the fixture decision.

## Risks / Trade-offs

The editor's own chrome changes between versions — a moved activity bar
icon, a renamed menu. The pictures would then change for a reason that
is not this product's doing. That is true of the hand-taken ones too,
and at least a spec makes it visible in a diff rather than silently
leaving a stale picture in place.

Driving VS Code's UI means selecting inside its workbench DOM, which is
not a public API and can move under a version bump. The mitigation is to
select as little as possible: open a view by running its command through
the extension, then capture, rather than clicking a path through menus.

The capture is slow — an editor launch per run. It is not in the
ordinary suite for that reason.
