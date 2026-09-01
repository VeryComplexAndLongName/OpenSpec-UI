## Context

See `proposal.md` for the measurements. `.github/workflows/quality.yml`
defines seven jobs (`quality`, `openspec-validate`,
`extension-integration`, `version-packages`, `release-extension`,
`browser-e2e`, `dependency-review`), none of which sets
`timeout-minutes`. GitHub's default is 360 minutes.

## Goals / Non-Goals

**Goals:**

- Convert a hung job from "a person eventually notices" into "CI fails and
  names the job".
- Choose each ceiling from that job's own observed behavior.

**Non-Goals:**

- Making CI faster. A ceiling is not a performance budget.
- Step-level timeouts. The hang was in a step, but the job-level ceiling
  already ends it, and a per-step ceiling would need re-tuning every time
  a step is added.
- Retrying a timed-out job automatically. A hang that repeats is
  information; a hang silently retried is not.

## Decisions

### A ceiling is a hang detector, sized well above legitimate variance

Each job's ceiling is set several times its observed maximum, not near its
median:

| job | max | ceiling |
|---|---|---|
| Dependency review | 8 s | 5 min |
| OpenSpec change validation | 35 s | 5 min |
| Extension integration and package | 60 s | 10 min |
| Typecheck, lint, test, and build | 79 s | 10 min |
| Standalone browser and accessibility | 639 s | 20 min |
| Version pending changesets | 27 s | 10 min |
| Tag and release VS Code extension | 25 s | 10 min |

**Rejected alternative**: one shared value for every job, for tidiness.
Rejected on the measurements — `browser-e2e` has a 7.5x spread between
median and observed maximum (a *successful* run took 10.6 minutes,
plausibly a slow browser download), while four jobs finish in under a
minute. Any single number is either too tight for the first or useless for
the rest.

**Rejected alternative**: set each ceiling close to the observed maximum,
so hangs are caught sooner. Rejected — the cost of a false failure is a
red pull request and a human investigating a non-problem, while the cost
of catching a hang ten minutes later is ten minutes of runner time. Those
costs are not symmetric, and the ceiling should be wrong in the cheaper
direction.

### `browser-e2e` gets the widest ceiling, on evidence rather than caution

Its 639 s maximum is the only observation in the sample that exceeds two
minutes, and it succeeded. Twenty minutes leaves roughly double that
headroom.

**Rejected alternative**: treat the 639 s run as an outlier to be excluded.
Rejected — it is one of twelve samples, it passed, and excluding the
inconvenient observation is how a ceiling becomes a flake generator.

### The release job is bounded too, despite the risk of interrupting a publish

`release-extension` tags and publishes. A timeout could in principle
interrupt it mid-publish.

**Rejected alternative**: leave `release-extension` unbounded because
interrupting a release is worse than a hang. Rejected — a *hung* release
holds its lock on the release path for six hours and blocks every
subsequent release just as effectively, while telling nobody. At a 25 s
observed maximum, a 10-minute ceiling means the job is 24x over budget
before it fires, which is far past "slow" and firmly into "stuck".

## Risks / Trade-offs

- **[Risk]** A future job that is legitimately slower than its ceiling
  (a larger e2e suite, a slower runner) fails as if hung. →
  **Mitigation**: the ceilings are derived from measurements recorded in
  proposal.md, so the correction is to re-measure and raise the number,
  and the failure message names the job and its limit.
- **[Trade-off]** Ceilings drift out of date as the suite grows. Accepted;
  a stale ceiling that is too generous still beats 360 minutes, and the
  failure mode of one that is too tight is loud rather than silent.

## Migration Plan

None. `timeout-minutes` is a per-job field with an existing default; adding
it changes no step, trigger, permission or condition.

## Open Questions

None.
