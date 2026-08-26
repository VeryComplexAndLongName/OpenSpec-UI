## Why

The user asked directly on 2026-08-25/26 what this project is missing.
The most evidence-backed answer, from the same day's own history: five
separate changes on 2026-08-25 each hand-bumped `package.json`'s
`version` and hand-wrote a `CHANGELOG.md` entry across up to three
packages at once, and one of those changes (`add-aspnet-core-templates`,
discovered later that day) initially forgot to bump `packages/core`
entirely -- caught only because the user asked directly, not by any
check. This is exactly the failure mode
[Changesets](https://github.com/changesets/changesets) exists to prevent:
a small, git-tracked markdown file per pending change records which
package(s) are affected and at what semver level, and a single command
(`changeset version`) applies every pending one at once, computing every
package's bump and `CHANGELOG.md` entry instead of relying on a human
(or an agent) to remember to do it by hand every time.

## What Changes

- Add `@changesets/cli` as a root dev dependency.
- Add `.changeset/config.json`: independent versioning (no `fixed`/
  `linked` groups -- packages here have never bumped in lockstep),
  `commit: false` (this repo's own OpenSpec change commits handle that),
  `ignore: ["openspec-ui"]` (the private workspace root, always `0.0.0`,
  never a release artifact).
- Add `"private": true` to `packages/extension/package.json`. This was a
  real, previously-unstated fact (the extension was never `npm
  publish`ed either -- only packaged by `vsce`/released to the VS Code
  Marketplace) that `changeset status` surfaced: it refuses to validate a
  dependency tree where a non-private package depends on private ones.
  Verified `vsce package` does not consult the `private` field at all --
  rebuilt the `.vsix` after this change and confirmed it packages
  identically.
- Add `.changeset/README.md` documenting the concept and this specific
  repository's workflow: how to propose a changeset, how it replaces
  hand-editing `version`/`CHANGELOG.md`, and -- explicitly -- what this
  repository does *not* use Changesets for (no npm publishing; the real
  release mechanism, `vsce` + the `release-extension` CI job, is
  unchanged and unreplaced).
- Add `changeset`/`changeset:version` scripts to the root `package.json`.
- Update root `README.md`'s "Versioning" section to reference the new
  workflow, and correct its already-stale package-version table (last
  updated before today's several bumps) as a side effect of touching this
  section.
- Update `openspec/config.yaml`'s `operations.apply.guidance` so future
  OpenSpec changes propose a changeset instead of hand-editing
  `package.json`'s `version` field.
- No changeset is added for this change itself: adding the tool is
  root-level tooling with no version-worthy behavior change for any
  package (matching how `.github/dependabot.yml` changes were treated
  earlier today).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; CI/tooling adoption, not a specified behavior)

## Impact

- `package.json` (root)
- `package-lock.json`
- `.changeset/config.json` (new)
- `.changeset/README.md` (new)
- `packages/extension/package.json`
- `README.md`
- `openspec/config.yaml`
