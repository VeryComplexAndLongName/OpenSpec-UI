# Design

## Decisions

**The check is a list of pictures, not of specs.** `scripts/check-screenshots.mjs`
walks `docs/images/**/*.png`, and for each file requires either a spec
that writes that exact path (found by reading the `e2e` sources) or an
entry in a baseline file naming the picture and why no spec can take it.
A new picture added by hand fails until one of the two is true.

Rejected: checking image modification dates against package versions. It
would fail every picture whenever anything released, including the ones
that are still correct, and a check that cries wolf gets a baseline
entry for everything.

Rejected: comparing rendered screens pixel by pixel against the
committed picture. That is a visual regression suite — it fails on font
rendering between machines, and its job is to catch design changes,
which is not the defect here.

**A webview screen is captured from the standalone shell, not from the
editor.** `packages/webui` renders the same components in both hosts.
The picture of the harness settings panel is a picture of the web UI,
and it is reachable from Playwright; the fact that a reader sees it
inside VS Code does not make it an editor surface. The extension's
documentation says where the panel is opened from and shows the
captured picture.

Rejected: driving VS Code's own window. The integration tests run inside
a real editor but have no screenshot API, and adding a screen-capture
dependency to take pictures of an editor chrome that changes with every
VS Code release buys a picture that fails for reasons unrelated to this
product.

**A genuinely editor-native surface is documented without a picture, or
with one marked as hand-taken and dated.** The existing requirement says
the first; this change adds the second as an explicit, listed exception
rather than a silent one, because a tree view is the thing a reader is
looking for and a paragraph describing an icon column is worse than a
dated picture. What the baseline forbids is an unlisted hand-taken
picture, which is the actual defect: nobody knows it is stale.

**A third reason, added while implementing: `published-asset`.** Four
pictures (`docs/images/standalone/0*.png`) turned out to be assets made
for a post published elsewhere, referenced by no document in this
repository. Neither existing reason describes them, and listing them as
editor-native would have been a lie a reviewer could not see through.
They are listed with their own reason and their date, which leaves the
real question — keep them or delete them — visible rather than settled
by a lint. The set stays closed: three members, each meaning something
different.

**Capture specs stay where the ones that exist are.**
`packages/server/e2e/` already holds `harness-screenshots.spec.ts`; new
captures are added there, in files named for the screens they take, and
run under the existing browser suite. A selective run is how a second
`role="status"` region once broke a spec nobody ran, so the suite stays
one suite.

## Non-Goals

- A visual regression test.
- Any change to a screen, a layout, or a component.
- Capturing the pipeline view — that belongs to
  `a-graph-of-what-is-running`, in flight at the time of writing.
- Pictures of anything outside this repository's documentation.

## Risks / Trade-offs

**More browser specs mean a longer browser suite.** The suite already
has a budget check (`scripts/check-test-budgets.mjs`); the new captures
are added to it deliberately, and a capture that cannot fit is a finding
rather than a silent budget bump.

**The baseline is an escape hatch.** Anything can be added to it, which
is how it stops being a check. Two rules keep it honest: every entry
states the reason no spec can take that picture, and the reason is one
of a closed set — an editor-native surface, or an external product.
A reviewer can see the whole list in one file.

**A capture that lands while this one is being written.**
`a-graph-of-what-is-running` added `packages/server/e2e/pipeline.spec.ts`
and the picture it takes, in `main` as #414 while this was being
proposed. The check reads the `e2e` sources rather than a list of
expected pictures, so a capture added by another change is found without
this one being updated — which is the property that makes the check
survive the next change to do the same thing.

**No protocol impact.** No command, event, or adapter is touched.
