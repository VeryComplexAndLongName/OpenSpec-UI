# Every screenshot is taken by a spec

## Why

`openspec/specs/openspec-workbench/spec.md` already requires it:
"A screenshot used in this repository's documentation SHALL be captured
from the running standalone UI by an end-to-end test, not taken by
hand", because "a hand-taken screenshot goes stale silently: the screen
changes, the picture does not, and nothing fails."

Twenty of the twenty-six pictures in `docs/images/` predate that
requirement and nothing has brought them under it. Six standalone images
are produced by `packages/server/e2e/harness-screenshots.spec.ts`,
`change-charts.spec.ts` and `pipeline.spec.ts`; the rest are hand-taken,
and their dates
say how well that works: eleven standalone images and nine extension
images, most last touched on 22 August, describing a product that has
shipped twenty-eight changes since.

Raised in review on 2026-09-12 as "update all the screenshots". Taking
twenty new pictures by hand would satisfy that sentence and reproduce
the defect in six weeks. The requirement already says what to do
instead, and this change is the work of honouring it.

## Capabilities

### New

- A check that fails when a picture in `docs/images/` is neither
  produced by a named end-to-end spec nor listed, with its reason, as
  one no spec can take.
- End-to-end capture for every standalone screen that has a hand-taken
  picture today.

### Modified

- The existing screenshot requirement covers the extension's
  documentation too: a screen that is the shared web UI inside a webview
  is captured from the standalone shell, and a screen that is genuinely
  editor-native (tree views, quick picks, menus) is either documented
  without a picture or carries one that is explicitly marked as
  hand-taken and dated.

## Out of scope

Redesigning any screen. A capture that fails because the screen changed
is reported, and the picture is retaken; nothing about the product is
adjusted to make a screenshot nicer.

`docs/images/standalone/pipeline.png` and the spec that produces it.
That picture and `packages/server/e2e/pipeline.spec.ts` belong to
`a-graph-of-what-is-running`; the check this change adds finds that
capture like any other, and no capture for the pipeline view is added
here.

Screenshots in articles under `docs/articles/`. They reference the same
files in `docs/images/`, so they are covered by the check without being
a separate surface.

## Out of scope: taking a picture of a VS Code quick pick

The editor draws quick picks and menus outside any page the tests can
reach, and the existing requirement already says what to do there:
write the documentation to stand without the picture rather than carry
one nothing checks.
