Twenty of twenty-six pictures in `docs/images/` are hand-taken, most
from 22 August, against a requirement that has said since
`openspec/specs/openspec-workbench/spec.md` that they must not be.

`docs/images/standalone/pipeline.png` is not among them:
`a-graph-of-what-is-running` added the spec that takes it. The check
must find that capture without being told about it.

## 1. The check

- [ ] 1.1 `scripts/check-screenshots.mjs` walks `docs/images/**/*.png`
  and, for each file, finds either a `packages/server/e2e/*.spec.ts`
  that writes that exact path or an entry in
  `scripts/screenshot-baseline.json`. Anything else fails with the
  picture's path.
- [ ] 1.2 A baseline entry carries `path`, `reason` (one of
  `editor-native` or `external-product`) and `captured` (an ISO date).
  An entry with any other reason fails to parse rather than being
  accepted.
- [ ] 1.3 `scripts/check-screenshots.test.mjs` covers: a picture with a
  spec passes, a picture with neither fails, a baseline entry with an
  unknown reason fails, and a baseline entry naming a picture that no
  longer exists fails — a baseline that outlives its picture is how the
  list stops describing the repository.
- [ ] 1.4 `npm run lint:screenshots` runs it, and `lint` in the root
  `package.json` includes it.

## 2. Standalone captures

Each task adds a capture to `packages/server/e2e/` for a picture that is
hand-taken today, and replaces the committed file with the spec's
output.

- [ ] 2.1 `view-summary.png` — the change summary view.
- [ ] 2.2 `change-editor.png` — the change editor.
- [ ] 2.3 `diff-preview.png` — the diff preview.
- [ ] 2.4 `templates.png` — the template catalog.
- [ ] 2.5 `processes.png` — the process list.
- [ ] 2.6 `run-command.png` — the run command surface.
- [ ] 2.7 `run-with-harness.png` — the "Run with Agentic Harness" entry
  point.
- [ ] 2.8 `01-permission-request.png`, and no other file in this task —
  the permission request surface.
- [ ] 2.9 `02-human-only-inbox.png` — the "Waiting on somebody" block.
- [ ] 2.10 `03-observation-record.png` — the observation record.
- [ ] 2.11 `04-mechanical-checks.png` — the mechanical-check result.
- [ ] 2.12 Each capture waits on a named element and fails when it is
  absent. A capture that screenshots the page after a fixed delay is not
  a capture that reports a changed screen, which is the entire reason
  for this requirement.

## 3. Extension pictures

- [ ] 3.1 `docs/images/extension/overview-compact.png` and
  `overview-expanded.png`: decide per picture whether the surface is the
  shared web UI in a webview (capture it from the standalone shell) or
  an editor tree view (baseline it as `editor-native` with today's
  date). Record which, and why, in this task.
- [ ] 3.2 `archive-actions.png`, `archive-tasks.png`,
  `nested-tasks.png`, `specs-list.png`, `template-actions.png`: tree and
  menu surfaces. Baseline each as `editor-native`, retaken by hand
  against the current build, with the date recorded in the baseline.
- [ ] 3.3 `repository-setup.png` and `specs-editor.png`: same decision as
  3.1, recorded the same way.
- [ ] 3.4 Any extension picture whose surface no longer exists is
  deleted, and the paragraph that carried it is rewritten to stand
  without it. Do not keep a picture of a screen the product does not
  have.

## 4. Verification

- [ ] 4.1 `npm run lint:screenshots` passes with every picture either
  spec-produced or baselined.
- [ ] 4.2 **Delegated to `claude-cli`**: run the whole browser suite
  (`npm run test:e2e` in `packages/server`, not a selected spec) and
  record the spec count, the pass count and the wall-clock time. A
  selective run once reported green while a second `role="status"`
  region broke a spec the change never mentioned.
- [ ] 4.3 The captured files are committed, and `git status` after a
  second suite run reports no modification — a capture that differs
  between two runs of the same build is a flaky picture, not a
  screenshot.
- [ ] 4.4 This change validates strictly. `check(validate-change)`
- [ ] 4.5 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 4.6 The browser suite's entry in `scripts/test-budget-baseline.json`
  is updated to its measured new value in the same commit that adds the
  captures, with the measurement quoted here.
- [ ] 4.7 A changeset exists for each package whose documentation
  changed. `check(changeset-present)`
