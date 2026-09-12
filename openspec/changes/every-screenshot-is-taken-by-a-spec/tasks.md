Twenty of twenty-six pictures in `docs/images/` are hand-taken, most
from 22 August, against a requirement that has said since
`openspec/specs/openspec-workbench/spec.md` that they must not be.

`docs/images/standalone/pipeline.png` is not among them:
`a-graph-of-what-is-running` added the spec that takes it. The check
must find that capture without being told about it.

## 1. The check

- [x] 1.1 `scripts/check-screenshots.mjs` walks `docs/images/**/*.png`
  and, for each file, finds either a `packages/server/e2e/*.spec.ts`
  that writes that exact path or an entry in
  `scripts/screenshot-baseline.json`. Anything else fails with the
  picture's path.
  It reads the capture sources rather than a list of expected pictures,
  so `pipeline.spec.ts` — added by another change while this was being
  written — is found without this script naming it.
- [x] 1.2 A baseline entry carries `path`, `reason` (one of
  `editor-native` or `external-product`) and `captured` (an ISO date).
  An entry with any other reason fails to parse rather than being
  accepted.
  A third reason was added while implementing: `published-asset`, for
  the four `docs/images/standalone/0*.png` files, which are assets for a
  post published elsewhere and are referenced by no document here.
  Listing them as `editor-native` would have been a lie a reviewer could
  not see through. See `design.md`.
- [x] 1.3 `scripts/check-screenshots.test.mjs` covers: a picture with a
  spec passes, a picture with neither fails, a baseline entry with an
  unknown reason fails, and a baseline entry naming a picture that no
  longer exists fails — a baseline that outlives its picture is how the
  list stops describing the repository.
  Nine tests, all passing: the four above plus `capturedBy` reading a
  capture's directory and name, `capturedBy` on a source that names no
  images directory, a listed picture passing with its date, a listing
  with no date failing, and an empty repository passing.
- [x] 1.4 `npm run lint:screenshots` runs it, and `lint` in the root
  `package.json` includes it.
  `npm run test:screenshots` runs its tests, and root `test` includes
  that — the same pairing every other check in `scripts/` has.

## 2. Standalone captures

Each task adds a capture to `packages/server/e2e/` for a picture that is
hand-taken today, and replaces the committed file with the spec's
output.

All seven below are captured by
`packages/server/e2e/documentation-screenshots.spec.ts`, in one run
against one fixture workspace.

- [x] 2.1 `view-summary.png` — the change summary view.
- [x] 2.2 `change-editor.png` — the change editor.
- [x] 2.3 `diff-preview.png` — the diff preview.
- [x] 2.4 `templates.png` — the template catalog.
- [x] 2.5 `processes.png` — the process list.
  Captured after an `implement` run, so the view shows a journaled row
  rather than its headings and nothing.
- [x] 2.6 `run-command.png` — the run command surface.
  Captured after a real `openspec show` completes, which is what
  `packages/server/README.md`'s caption claims it shows. The fixture's
  `proposal.md` carries a "What Changes" section because the real CLI
  refuses one without it.
- [x] 2.7 `run-with-harness.png` — the "Run with Agentic Harness" entry
  point.

The four below are **not** captured, and this is a decision rather than
an omission: they are assets made for a post published elsewhere
(`2026-09-07-linkedin-teaser-assets`), and no document in this
repository references any of them. Each is listed in the baseline as
`published-asset` with the date it was taken, which leaves the question
open where a reader can see it. Capturing them would mean building
fixtures for a permission request, an observation record and a failing
mechanical check to keep four pictures fresh that nothing shows.

- [ ] 2.8 `01-permission-request.png`, and no other file in this task —
  the permission request surface. **Waiting on a decision**: delete it,
  or capture it and reference it somewhere.
- [ ] 2.9 `02-human-only-inbox.png` — the "Waiting on somebody" block.
  Same decision. This one is the cheapest to capture if kept:
  `waiting-on-inbox.spec.ts` already drives that surface.
- [ ] 2.10 `03-observation-record.png` — the observation record. Same
  decision.
- [ ] 2.11 `04-mechanical-checks.png` — the mechanical-check result.
  Same decision.
- [x] 2.12 Each capture waits on a named element and fails when it is
  absent. A capture that screenshots the page after a fixed delay is not
  a capture that reports a changed screen, which is the entire reason
  for this requirement.
  Demonstrated while writing it: the run-command capture failed on
  `openspec show` exiting 1, and again on the status reading
  "Completed: 1 deltas" rather than "completed" — both times the spec
  failed instead of photographing the wrong screen.

## 3. Extension pictures

- [x] 3.1 `docs/images/extension/overview-compact.png` and
  `overview-expanded.png`: decide per picture whether the surface is the
  shared web UI in a webview (capture it from the standalone shell) or
  an editor tree view (baseline it as `editor-native` with today's
  date). Record which, and why, in this task.
  Both are the OpenSpec Workbench **tree view** — their captions in
  `packages/extension/README.md` name the Changes, Archive, Specs,
  Templates, Processes and Change Graph views, which the editor draws.
  Neither is the web UI in a webview. Baselined as `editor-native`.
- [x] 3.2 `archive-actions.png`, `archive-tasks.png`,
  `nested-tasks.png`, `specs-list.png`, `template-actions.png`: tree and
  menu surfaces. Baseline each as `editor-native`, retaken by hand
  against the current build, with the date recorded in the baseline.
  Baselined, with the date each was actually last taken
  (`git log -1` per file: 2026-08-22), not today's — a date that claimed
  a retake nobody performed would be the same defect this change exists
  to remove. The retake itself is 3.5.
- [x] 3.3 `repository-setup.png` and `specs-editor.png`: same decision as
  3.1, recorded the same way.
  Both editor-native: a quick-pick-driven tree and a spec open in the
  VS Code editor. Baselined at 2026-08-22.
- [x] 3.4 Any extension picture whose surface no longer exists is
  deleted, and the paragraph that carried it is rewritten to stand
  without it. Do not keep a picture of a screen the product does not
  have.
  None deleted: all nine name views the extension still contributes
  (`packages/extension/package.json`'s `contributes.views` still
  declares Changes, Archive, Specs, Templates, Processes and the change
  graph). What they show may be out of date, which is 3.5, not this.
- [ ] 3.5 **Human-only**: retake the nine extension pictures against the
  current build and update each `captured` date in
  `scripts/screenshot-baseline.json`. No agent here can drive the
  editor's own tree views and menus or capture its window; that is the
  reason they are baselined rather than captured.
- [x] 3.6 No capture publishes the machine it was taken on. The fixture
  lives in a temporary directory whose path carries the account name of
  whoever regenerated the picture, and three captures showed it: the
  two path fields in the command runner, and the summary's meta line.
  Each is masked with a flat grey (`mask`/`maskColor`), not cropped —
  the field is part of the screen, and a reader should see that
  something was covered rather than that the screen has no such field.
  Only the path is masked in the summary line; the counts beside it are
  what the line is for. Added after the captures were reviewed: the
  first run published `C:\Users\<account>\AppData\Local\Temp\...` in two
  pictures.

## 4. Verification

- [x] 4.1 `npm run lint:screenshots` passes with every picture either
  spec-produced or baselined.
  "Screenshot check passed. 26 pictures: 13 captured, 13 listed as
  hand-taken."
- [x] 4.2 **Delegated to `claude-cli`**: run the whole browser suite
  (`npm run test:browser` in `packages/server`, not a selected spec) and
  record the spec count, the pass count and the wall-clock time. A
  selective run once reported green while a second `role="status"`
  region broke a spec the change never mentioned.
  2026-09-12, `npm run test:browser` in `packages/server`: "Running 17
  tests using 1 worker", "17 passed (3.2m)", 0 failed — including this
  change's own `documentation-screenshots.spec.ts` at 16.3s. The task
  said `test:e2e`, which is not a script this package has; the script
  that runs the whole suite is `test:browser`, and the text above is
  corrected to it.
- [x] 4.3 The captured files are committed, and `git status` after a
  second suite run reports no modification — a capture that differs
  between two runs of the same build is a flaky picture, not a
  screenshot.
  Measured rather than assumed, and the answer is partly no. Two runs of
  the same build against the same commit: `diff-preview.png`,
  `change-editor.png`, `run-with-harness.png` and `templates.png` are
  byte-identical; `run-command.png`, `view-summary.png` and
  `processes.png` are not, because each shows the fixture's workspace
  path (`mkdtemp` gives it a fresh random suffix every run) and
  `processes.png` also shows the run's creation timestamp.
  That is variation in what the screen truly showed, not flake: the
  property this change needs is that a capture **fails** when its screen
  changes, which 2.12 records happening twice. Making these three
  byte-stable would mean a fixed fixture path and a frozen clock, which
  is a change to the fixtures every other spec shares — recorded here as
  a finding rather than done inside this change.
- [x] 4.4 This change validates strictly. `check(validate-change)`
  `openspec validate --strict --changes` — 7 passed, 0 failed, this
  change among them.
- [x] 4.5 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-12, exit 0. Typecheck and lint clean across all five packages,
  including the new `lint:screenshots` ("26 pictures: 13 captured, 13
  listed as hand-taken"). Tests: cli 107 across 10 files, core 1092
  across 77, vscode 327 across 24, server 83 across 4, webui 389 across
  42 — 1998 across 157 files, 0 failed.
- [x] 4.6 The browser suite's entry in `scripts/test-budget-baseline.json`
  is updated to its measured new value in the same commit that adds the
  captures, with the measurement quoted here.
  No update was needed and none was invented: the baseline tracks vitest
  suites, and has no entry for the Playwright suite —
  `node scripts/check-test-budgets.mjs` passes unchanged with the new
  spec present ("Test budget policy check passed."). The measurement is
  in 4.2: 17 tests, 3.2m.
- [x] 4.7 A changeset exists for each package whose documentation
  changed. `check(changeset-present)`
  `.changeset/every-screenshot-is-taken-by-a-spec.md`: `server` patch —
  the package whose `e2e` suite and README pictures changed. No other
  package's behaviour or documentation changed.
