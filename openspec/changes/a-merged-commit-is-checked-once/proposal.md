## Why

The owner asked on 2026-09-16 why every change runs the checks again and
again. `.github/workflows/quality.yml` runs the full set — `npm run verify`
and the build, the OpenSpec merge gate, the extension's integration suite
and its package, and the standalone browser suite — on every pull request
and on every push to `main`. One change therefore pays for four full runs:

| Run | What is new in it | Measured on 2026-09-16 |
| --- | --- | --- |
| The change's pull request | the change | #545: 5 min 00 s |
| The push to `main` when it merges | only the release path: the version pull request, a tag, a release, the manifest | #545's merge: 6 min 10 s, of which the release path took 1 min 44 s |
| The version pull request the bot updates | versions, changelogs, the lockfile, deleted changesets | 6 min 22 s |
| The push to `main` when that merges | the release | #543's merge: 5 min 58 s |

The browser suite is the longest job in each (4 min 14 s on #545's merge),
and on the second, third and fourth runs it tests code that has already
passed it, or a diff it cannot exercise.

## What Changes

- **A change is checked once, on its pull request.** The full set runs on a
  pull request, as it does now.
- **A push to `main` runs the release path only**: the version pull request,
  the tag and release, and the manifest. It no longer repeats the test jobs,
  and the release jobs stop depending on them.
- **The version pull request is checked for what it changes**: a clean
  install from the lockfile, the build, and the extension's package with its
  new version. The heavy jobs skip it.
- **`main` only receives what its pull request checked.** The repository's
  `main` ruleset requires the pull request checks to pass on a branch that is
  up to date with `main`, so a merge cannot land a combination nobody ran.
  This is a repository setting, changed by the owner or with the owner's
  approval, and recorded in the tasks.
- The README's sentence that the merge gate runs "on every push/PR" says
  where it runs now.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-quality`: which event runs the quality checks, the extension
  suite and the release path; a version pull request's own check; `main`
  receiving only a commit its pull request checked.

## Impact

- `.github/workflows/quality.yml`: job conditions and `needs`, one new job.
- The repository's `main` ruleset: required status checks, up to date with
  `main`; the "update branch" button enabled.
- `README.md`: one sentence about the merge gate.
- Not `.gitea/workflows/quality.yml`, which is its own pipeline.
