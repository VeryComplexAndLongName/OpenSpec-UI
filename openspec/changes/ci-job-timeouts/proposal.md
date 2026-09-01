## Why

Specific risk observed live on 2026-09-01: run 33494565528's "Extension
integration and package" job hung on `xvfb-run -a npm run test:integration`
for 25 minutes against a median of 55 seconds. It was noticed by a human
watching the pull request, not by CI, and it was still running when it was
cancelled by hand.

No job in `.github/workflows/quality.yml` sets `timeout-minutes`, so every
one of the seven inherits GitHub's default of **360 minutes**. A hung job
therefore occupies a runner for six hours and reports nothing until a
person intervenes. That job was diagnosed as a stuck runner rather than a
defect — the same commit had passed the same job twice minutes earlier —
which is precisely the case a timeout exists to convert from "someone
eventually notices" into "CI fails and says why".

Measured before proposing, over the last twelve successful runs of each
job:

| job | median | max |
|---|---|---|
| Dependency review | 7 s | 8 s |
| OpenSpec change validation (merge gate) | 30 s | 35 s |
| Extension integration and package | 55 s | 60 s |
| Typecheck, lint, test, and build | 71 s | 79 s |
| Standalone browser and accessibility | 85 s | **639 s** |
| Tag and release VS Code extension | 23 s | 25 s |
| Version pending changesets | 26 s | 27 s |

The last row of that table is the reason this change measures rather than
guesses. "Standalone browser and accessibility" has a **7.5x** spread
between its median and its observed maximum — a successful run took over
ten minutes. A uniform, plausible-looking ceiling of five minutes would
have started failing legitimate runs of that job while still being far too
generous for the four jobs that finish in under a minute.

## What Changes

- `.github/workflows/quality.yml`: every job gains `timeout-minutes`,
  chosen per job from its own measured maximum rather than a single shared
  value.
- No change to any job's steps, triggers, permissions, or conditions.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — CI configuration; no product-facing behavior changes, and no
requirement in `quality-gates` describes how long a gate may take.
`.openspec.yaml` sets `skip_specs: true` accordingly, matching the
precedent of `openspec/changes/archive/2026-08-31-internal-version-cascade/`
and `openspec/changes/archive/2026-09-01-task-granularity-rules/`.)

## Impact

- `.github/workflows/quality.yml` only.
- No `packages/*` change and no changeset.
- A hung job now fails within its ceiling instead of holding a runner for
  six hours.
