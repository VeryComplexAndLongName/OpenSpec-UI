## Why

The merge gate fails more often than it passes, and never on what it
checks.

`openspec-validate` carries `timeout-minutes: 5`. Measured on a run that
completed (4m04s total):

| Step | Duration |
| --- | --- |
| `npm ci` | **223.6 s** |
| `npm install --global @fission-ai/openspec` | 3.1 s |
| `npm install --global npm` | 2.1 s |
| checkout + setup-node + the validation itself | ~13 s |

`npm ci` is 92% of the job, and the actual validation takes 3.9 s.

The problem is not that `npm ci` is slow in absolute terms. It installs
762 packages totalling 254 MB of third-party code, with the npm cache
hitting (70 MB restored), on a two-core runner. The problem is
**variance**: the same job, on the same commit, took 2m22s on one run and
5m15s on another. A budget of 5 minutes sits at roughly the median of an
operation that routinely doubles.

`quality` does strictly more work — the same `npm ci`, plus typecheck,
lint, the whole test suite and every delivery build — and passes,
because it has 10 minutes to absorb the same variance. The gate that does
less has half the budget.

Observed on PRs #208, #213 and #214: `npm ci` killed mid-install, the
validation step never reached, `Terminate orphan process: npm ci` in the
log. #214 has now failed this way three times in a row while proposing a
Dependabot policy that has nothing to do with it.

## What Changes

- `.github/workflows/quality.yml`: `openspec-validate`'s
  `timeout-minutes` goes from 5 to 10, matching `quality`, which shares
  its dominant step.
- A comment recording the measurement, so the number is traceable to
  something rather than being another guess.

## Capabilities

### Modified Capabilities

- `release-quality`: a check's time budget accommodates the observed
  variance of its dominant step, so a check fails on what it verifies.

## Impact

- `.github/workflows/quality.yml` only.

## Explicitly out of scope

- **Making `npm ci` faster.** Caching `node_modules` keyed on the
  lockfile hash, or collapsing the three esbuild versions that produce
  127 of the lockfile's 164 platform-scoped entries, would both help —
  and both change what is installed, which is a larger question than
  whether this job has enough time to finish. This change buys the
  headroom; it does not claim to have made anything quicker.
- **Removing the global installs.** They cost 5.2 s of a 244 s job. They
  were an early suspicion, and the measurement refuted it.
- **Raising every job's budget.** `quality` and `browser-e2e` pass at
  their current budgets. Only the job whose budget is below its step's
  observed range is changed.
