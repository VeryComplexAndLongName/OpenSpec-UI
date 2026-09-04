# Design

## The contract, as it actually stands

Read from `OpenSpec-Ui-Homepage` rather than assumed. Its
`app/schemas/manifest.py` is the reference definition; this is what it
requires.

```jsonc
{
  "schema_version": 1,          // an unknown value is REJECTED, not parsed
  "generated_at": "2026-09-04T09:00:00Z",
  "repository": "VeryComplexAndLongName/OpenSpec-UI",
  "commit": "da177cb…",         // optional
  "products": [
    {
      "id": "vscode-extension", // stable key, NOT the npm name
      "name": "VS Code Extension",
      "package": "openspec-ui-vscode",   // optional
      "public": true,                     // default true
      "version": "0.36.0",
      "released_at": "2026-09-04T09:00:00Z", // optional
      "tag": "openspec-ui-vscode@0.36.0",    // optional
      "prerelease": false,                   // default false
      "summary": "OpenSpec Workbench inside VS Code.",
      "links": { "changelog": "…", "docs": "…", "release": "…", "marketplace": "…" },
      "artifacts": [{ "kind": "vsix", "url": "…", "size_bytes": 1234, "sha256": "…" }],
      "changes": [{ "kind": "minor", "summary": "…" }]
    }
  ]
}
```

Three of its rules shape everything below:

- **Unknown fields are ignored**, so this producer may add fields before
  the site renders them.
- **An unknown `schema_version` is rejected outright**, and the site then
  keeps showing its last good snapshot. Bumping the version is therefore
  a breaking change that the site must learn *first*.
- **Product ids are unique and stable.** The schema enforces uniqueness
  and its comment says why they are decoupled from package names: "so
  that repository refactoring cannot break the site or re-announce an
  existing version under a new identity."

## Decisions

### 1. The five products and their ids are copied, not chosen

`github_source.py` already defines them, and the site's database is
keyed by them:

| id | name | source | public |
| --- | --- | --- | --- |
| `vscode-extension` | VS Code Extension | `packages/extension` | yes |
| `standalone-app` | Standalone App | `packages/server` | yes |
| `core` | Core | `packages/core` | yes |
| `shared-ui` | Shared UI | `packages/webui` | **no** |
| `ci-cli` | CLI | `packages/cli` | **no** |

Note `standalone-app` is `@openspec-ui/server` and `shared-ui` is
`@openspec-ui/webui`: the ids do not match the package names, and must
not be "corrected" to. A test pins all five, because this is the one
mistake here that is silent — the site would simply announce five new
products and every existing version again.

The two non-public products are carried with `public: false` rather than
omitted. The site's schema has the flag and its `public_products`
property applies it; deciding visibility here as well would put the
decision in two places.

### 2. Published to a branch, not to a GitHub Release asset

The site fetches `manifest_url` over plain HTTP with `Accept:
application/json` and no credentials, and its configured default is
already:

```
https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/release-manifest/releases.json
```

`raw.githubusercontent.com` serves that with no authentication and
without consuming the GitHub API rate limit that the current bridge is
constrained by. A Release asset would need the API to discover its URL —
reintroducing the cost this change exists to remove.

The branch holds that one file and no history of the repository. It is
force-updated, since only the current state is ever read.

### 3. Changelog entries are parsed here, deliberately

The site's schema says why, and it is not an implementation detail:

> Parsed on the producing side because that is where the changesets
> structure and the repository context live. The site receives
> display-ready items and never renders third-party Markdown into an
> email.

Changesets writes `### Major Changes` / `### Minor Changes` /
`### Patch Changes` under each version heading in `CHANGELOG.md`, which
maps onto `ChangeEntry.kind` directly. Only the newest version's entries
are carried: the manifest describes the current release, not the history.

A `CHANGELOG.md` that cannot be parsed yields **no** `changes` for that
product rather than a guess. `changes` is optional in the schema, and an
empty list is honest where an invented summary is not.

### 4. Published only when a version actually changes

`generated_at` and `commit` move on every push. If the manifest were
written on every push to `main`, the branch would gain a commit per push
while saying nothing new.

The publish step compares the set of `id@version` pairs against what the
branch already holds, and pushes only when that set differs. The site is
unaffected either way — `sync_releases` dedupes announcements by
`product_id@version` — so this is about not generating noise, and about
`commit` meaning "the commit these versions were released from" rather
than "the last push".

### 5. The generator is a script, not a package export

Nothing in the product needs to read a release manifest; only CI writes
one. A script under `.github/scripts/` keeps it out of the published
packages and out of the browser bundle, next to
`interpret-npm-audit.mjs`, which is there for the same reason.

Its tests run in `packages/core`'s suite against fixture directories, so
the parsing rules are exercised without a repository checkout.

### 6. The extension's artifact comes from the release that already exists

`release-extension` creates the tag `openspec-ui-vscode@<version>` and
attaches the VSIX. The manifest's `artifacts` and `links.release` for
`vscode-extension` are read from that release rather than constructed by
string-building, so a change in how the release is made cannot leave the
manifest pointing at a URL that does not resolve.

The other four products have no downloadable artifact and carry an empty
`artifacts` list — again, absent rather than invented.

## Rejected alternatives

- **Extending `github_source.py` instead.** It would remain a copy of
  this repository's layout living in another repository, which is the
  defect, not the implementation.
- **Publishing one manifest per package.** The schema is a single
  document with a `products` array, and the site fetches one URL.
- **Deriving `changes` from git history.** Changesets already produces a
  categorised changelog; re-deriving it from commits would disagree with
  the published `CHANGELOG.md` the same manifest links to.
- **Generating during the `version-packages` job.** That job runs the
  changesets action and opens a pull request; the versions are not on
  `main` until that pull request merges. Generating there would publish
  versions that had not shipped.

## Open questions

- Whether `released_at` should be the release commit's timestamp or the
  moment of generation. They differ by the length of a CI run, and the
  field is optional; the commit timestamp is the more meaningful of the
  two and is what this change proposes.
- Whether `summary` per product should live in this repository or keep
  coming from the site's own `PackageSpec` list. Carrying it here makes
  the manifest self-describing; leaving it out means the site keeps
  today's text. This change carries it, and the site ignores what it
  does not use.
