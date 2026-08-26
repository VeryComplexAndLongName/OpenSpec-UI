# Changesets

This folder is managed by [`@changesets/cli`](https://github.com/changesets/changesets),
which replaces this repository's previous practice of hand-editing every
affected package's `version` in `package.json` and its `CHANGELOG.md`
entry for every user-facing change. That manual process was error-prone
in exactly the way changesets exists to prevent: it is easy to forget to
bump one package among several in the same change, or to forget the bump
entirely — both have happened in this repository's history.

## What a changeset is, here specifically

A changeset is a small markdown file under `.changeset/` (not this
`README.md` — a new one per pending change) recording two things: which
package(s) a change affects, and at what semver level (`patch`/`minor`/
`major`, per this repo's existing policy in the root `README.md`'s
"Versioning" section). It does **not** itself change any `package.json`
or `CHANGELOG.md` — it is a *proposal*, checked into git alongside the
code change it describes, until it is later applied.

## Workflow in this repository

1. While working an OpenSpec change that has an externally visible
   effect on one or more packages, run `npx changeset` from the repo
   root. Pick the affected package(s), the bump level for each, and
   write a short summary — this becomes that package's `CHANGELOG.md`
   entry once applied. This step replaces manually editing `version` in
   `package.json` and adding a `CHANGELOG.md` entry by hand; do not do
   both.
2. Commit the generated `.changeset/<random-name>.md` file as part of
   the same change (same PR) as the code it describes — this is
   equivalent to today's practice of bumping the version and updating
   the changelog in the same commit as the fix, just represented as a
   separate small file instead of an inline edit.
3. Applying pending changesets (`npx changeset version`, run
   separately — not part of every individual change) consumes every
   `.changeset/*.md` file present, bumps each affected package's
   `version` in `package.json`, writes its `CHANGELOG.md` entries, and
   deletes the consumed changeset files. `openspec-ui-vscode`'s
   `CHANGELOG.md` is a real file `vsce package` ships in the VSIX, so
   its changeset-generated entries are still what users see in the VS
   Code Marketplace "Details" tab and in GitHub Releases.

## What this repository does *not* use changesets for

- **No npm publishing.** Every workspace package is `"private": true`;
  none of them are ever published to the npm registry. `access:
  "restricted"` in `config.json` is a harmless default that is never
  exercised — this repo never runs `changeset publish`.
- **The actual release mechanism is unchanged.** `openspec-ui-vscode`
  still ships via `vsce`/the VS Code Marketplace, and CI
  (`release-extension` job in `.github/workflows/quality.yml`) still
  tags the commit and publishes a GitHub Release with the built `.vsix`
  once `package.json`'s version has no matching git tag yet — changesets
  only produces the version bump and changelog entry that trigger that
  existing pipeline; it does not replace it.
- **`openspec-ui`** (the private workspace root, always `0.0.0`) is
  listed in `config.json`'s `ignore` array — it is a workspace
  container, never a release artifact, and was never bumped by hand
  either.
- `packages/extension/package.json` did not have `"private": true` set
  before Changesets was adopted (an accurate but previously unstated
  fact — it was never `npm publish`ed either, only packaged by `vsce`).
  `changeset status` refuses to validate a tree where a non-private
  package depends on private ones, so this was made explicit rather than
  worked around; `vsce package`/`publish` do not consult the `private`
  field at all, so this has no effect on the actual VS Code Marketplace
  release.

See the [full changesets documentation](https://github.com/changesets/changesets)
for anything not covered above, including its own
[common questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md).
