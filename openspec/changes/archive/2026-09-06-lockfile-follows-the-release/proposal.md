## Why

`package-lock.json` records a version for each workspace, and the release
does not update it.

`changesets/action` bumps every `packages/*/package.json` and writes the
CHANGELOGs; the lockfile is not in its diff. So each release leaves the
lockfile one release behind for whichever packages were bumped. Right
now, measured on 2026-09-04:

```
packages/cli:  package.json=0.2.0  lockfile=0.1.2  <-- STALE
```

The other four agree — but not because anything keeps them in step.
They were stale too until Dependabot's #208 and #209 regenerated the
lockfile for unrelated dependency bumps and swept the drift away as a
side effect. That is the actual defect: the lockfile is repaired by
accident, when a dependency happens to change, and drifts again at the
next release.

Two costs, neither fatal and both real:

- **The lockfile stops being a faithful record.** It is the file that
  says what a reproducible install produces, and it disagrees with the
  package it describes.
- **Every Dependabot pull request carries unrelated noise.** #209 was a
  pdfkit patch bump whose diff also moved four workspace version lines,
  because regenerating the lockfile swept in whatever drift had
  accumulated. A reviewer has to separate the two by eye.

## What Changes

- The repository's `changeset:version` script runs
  `npm install --package-lock-only` after `changeset version`, so the
  lockfile is part of the same commit that bumps the versions.
- `.github/workflows/quality.yml` points the release action at that
  script rather than at its built-in default, so CI and a local run do
  the same thing.
- The one stale entry today is corrected in the same change.

## Capabilities

### Modified Capabilities

- `release-quality`: a release updates the lockfile alongside the
  versions it bumps.

## Impact

- Root `package.json` (one script), `.github/workflows/quality.yml` (one
  input), and `package-lock.json` (one line today).
- No package source changes; nothing published changes; no changeset.

## Explicitly out of scope

- **Re-resolving dependencies during a release.**
  `npm install --package-lock-only` was measured before being proposed:
  against this repository it changed exactly one line, the stale
  workspace version, and touched no dependency. If that ever stops being
  true, this step would start slipping dependency updates into a release
  pull request, and that is the thing to watch for.
- **Making Dependabot's diffs smaller by other means.** They get smaller
  because the drift stops accumulating, not because anything about
  Dependabot changes.
