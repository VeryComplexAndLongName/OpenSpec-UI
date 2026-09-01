Every value below comes from a measurement recorded in proposal.md, not
from a guess. If a number here looks arbitrary, re-read that table before
changing it — in particular, `browser-e2e`'s ceiling is wide because a
*successful* run of it took 639 seconds.

## 1. Timeouts

- [x] 1.1 `.github/workflows/quality.yml`, job `quality` ("Typecheck,
  lint, test, and build"): add `timeout-minutes: 10`.
- [x] 1.2 Same file, job `openspec-validate` ("OpenSpec change validation
  (merge gate)"): add `timeout-minutes: 5`.
- [x] 1.3 Same file, job `extension-integration` ("Extension integration
  and package"): add `timeout-minutes: 10`. This is the job that hung for
  25 minutes on 2026-09-01.
- [x] 1.4 Same file, job `version-packages` ("Version pending
  changesets"): add `timeout-minutes: 10`.
- [x] 1.5 Same file, job `release-extension` ("Tag and release VS Code
  extension"): add `timeout-minutes: 10`.
- [x] 1.6 Same file, job `browser-e2e` ("Standalone browser and
  accessibility"): add `timeout-minutes: 20`. Do **not** reduce this to
  match the other jobs: its observed maximum is 639 s against an 85 s
  median, and a tighter ceiling would fail runs that pass today.
- [x] 1.7 Same file, job `dependency-review` ("Dependency review"): add
  `timeout-minutes: 5`.

## 2. Prohibitions

- [x] 2.1 Do **not** add `timeout-minutes` to any individual step. The
  job-level ceiling already ends a hung step, and per-step values need
  re-tuning whenever a step is added — see design.md's Non-Goals.
- [x] 2.2 Do **not** change any job's `steps`, `if`, `needs`,
  `permissions`, `runs-on`, or the workflow's `on` triggers. This change
  adds one field per job and nothing else.
- [x] 2.3 Do **not** add automatic retry for a timed-out job. A hang that
  repeats is information; a hang silently retried is not.

## 3. Verification

- [x] 3.1 `git diff .github/workflows/quality.yml` shows exactly seven
  added lines, one per job, and no other change. This is the check that
  proves task 2.2 held.
- [x] 3.2 The file is valid YAML and every job still parses — confirmed by
  CI running at all on the pull request for this change, which is itself
  the test. Settled on PR #154: all five non-skipped jobs ran and passed,
  which cannot happen if the workflow fails to parse.
- [x] 3.3 `openspec change validate --strict ci-job-timeouts` — passed
  ("Change \"ci-job-timeouts\" is valid").
- [x] 3.4 No changeset (CI configuration only, no `packages/*` change) —
  matches the precedent in
  `openspec/changes/archive/2026-08-31-internal-version-cascade/`.
  Confirmed no changeset was added for this change (the only untracked
  file in `.changeset/` is `checkpoint-storage-split.md`, pre-existing
  and unrelated).
- [x] 3.5 Confirm from this change's own pull request that every job still
  completes well inside its new ceiling; note in this task the slowest
  job's actual duration on that run, so the next person adjusting these
  numbers has one more measurement rather than one more opinion.
  Measured on PR #154, the first run under these ceilings:
  Standalone browser and accessibility 1m27s against 20 min (the
  slowest); Typecheck, lint, test and build 1m17s against 10 min;
  Extension integration and package 1m00s against 10 min; OpenSpec change
  validation 36s against 5 min; Dependency review 4s against 5 min. Every
  job finished inside a tenth of its ceiling — the intended margin, since
  a ceiling detects a hang rather than budgeting performance.
