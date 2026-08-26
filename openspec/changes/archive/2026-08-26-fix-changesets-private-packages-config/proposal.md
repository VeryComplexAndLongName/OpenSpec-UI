## Why

Discovered while adding the first real changeset (`signal-run-completion`)
on 2026-08-26, immediately after `adopt-changesets` merged: `npx changeset
status` reported an empty "Packages to be bumped" list despite
`@changesets/read` correctly finding the changeset (verified directly:
`node -e` against `@changesets/read` returned it with the right package
names and bump types), and `npx changeset version` printed "All files have
been updated" while touching nothing at all -- no version bump, no
`CHANGELOG.md` entry, changeset file not consumed. Traced by calling
`@changesets/assemble-release-plan` directly (bypassing the CLI, which
swallows the underlying error): `TypeError: Cannot read properties of
undefined (reading 'version')` in `getRelevantChangesets`, at
`allowPrivatePackages: config.privatePackages.version` --
`.changeset/config.json` (written by hand during `adopt-changesets`,
`changeset init`'s interactive wizard having failed non-interactively) was
missing the `privatePackages` field entirely, a required config key in
`@changesets/cli@3.0.1` ("Opt in to tracking non-npm / private packages")
that the standard schema documented in changesets' own README does not
mention as mandatory. Since every package in this workspace is
`"private": true`, this silently broke every future `changeset
version`/`status` call -- not a one-off, a total blocker for the entire
tool adopted just yesterday.

## What Changes

- Add `"privatePackages": { "version": true, "tag": false }` to
  `.changeset/config.json`: `version: true` because every package here is
  private and still needs version/changelog computation; `tag: false`
  because this repository's own `release-extension` CI job already tags
  `openspec-ui-vscode@<version>` on push to `main` -- changesets' own git
  tagging (a `publish`-adjacent feature this repo never uses) would be a
  second, redundant tagging mechanism.
- Verified the fix directly against `@changesets/assemble-release-plan`
  (confirmed a correct release plan: `openspec-ui-vscode` 0.20.2 ->
  0.21.0, `@openspec-ui/webui` 1.9.1 -> 1.10.0) before re-running the real
  CLI, then confirmed `npx changeset status`/`npx changeset version` both
  work correctly end to end.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; a configuration bugfix for tooling adopted yesterday, not a
specified product behavior)

## Impact

- `.changeset/config.json`
