## Why

An outage at npm's audit endpoint takes down the entire CI pipeline for
every pull request, regardless of what the pull request contains.

`npm audit --omit=dev --audit-level=high` is the last step of the
`quality` job, which has a 10-minute limit — and **every other job in the
workflow declares `needs: quality`**. So when the audit step fails, the
merge gate, the extension integration suite, the browser suite and the
release jobs are all skipped, and the pull request shows a red check it
had nothing to do with.

This is not hypothetical. On #210, twice in a row:

```
04:59:17  npm run verify   ✓   263 tests passed
04:59:18  npm audit        started
05:06:19  npm warn audit 503 Service Unavailable - POST
          https://registry.npmjs.org/-/npm/v1/security/audits/quick
          npm error audit endpoint returned an error
          ##[error]The operation was canceled.
```

npm retried a failing endpoint for **seven minutes**, then the job hit
its 10-minute wall with all of its actual work already finished and
green. A third attempt, once the registry recovered, passed the same job
in 7m12s — still most of the allowance spent on one network call.

Two distinct faults are being conflated here, and that is the root of it:

1. **The audit found a high-severity advisory.** A real result. Should
   fail a check.
2. **The audit could not run.** A registry outage, a timeout. Not a
   result at all — it says nothing about the dependencies.

`npm audit` exits non-zero for both, so today the second reads exactly
like the first, and takes the whole pipeline with it.

## What Changes

- `.github/workflows/quality.yml`: `npm audit` moves out of `quality`
  into its own job, which nothing depends on. A failing audit no longer
  skips the merge gate, the integration suite or the browser suite.
- That job distinguishes "found something" from "could not run": an
  advisory fails it; an unreachable or slow registry is reported as a
  warning and does not.
- The audit command is bounded so a stalling registry cannot consume a
  job's whole time budget before failing.

## Capabilities

### Modified Capabilities

- `release-quality`: the dependency audit is a check in its own right,
  and cannot fail the rest of CI on a network fault.

## Impact

- `.github/workflows/quality.yml` only. No package, source or test
  changes.

## Explicitly out of scope

- **Making the audit non-blocking.** A genuine high-severity advisory
  must still fail its check. This change isolates the audit; it does not
  weaken it, and treating "could not run" as a pass is not the same as
  treating a finding as a pass.
- **Removing `needs: quality` from the other jobs.** Not running an
  integration suite against code that does not typecheck is deliberate
  and unrelated to the audit.
- **Replacing `npm audit` with another scanner.** `dependency-review`
  already covers pull-request dependency changes separately; which
  scanners this repository runs is a different question from whether one
  of them can take down the pipeline.
