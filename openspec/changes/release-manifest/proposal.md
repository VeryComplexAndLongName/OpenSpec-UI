## Why

The homepage cannot see what this repository ships, and the workaround it
uses instead is documented in its own source as temporary.

`OpenSpec-Ui-Homepage` reconstructs release information by reading this
repository through the GitHub API. Its `app/releases/github_source.py`
says what that costs, in its own words:

> This is a bridge, not a destination: it hard-codes `packages/<name>`
> paths and would break on a monorepo reshuffle. Once CI publishes
> `releases.json`, switch `HOMEPAGE_RELEASE_SOURCE` to `manifest` and
> this file becomes dead weight.

> Cost note: three API calls per product, so about 15 per sync across the
> five packages. Anonymous GitHub allows 60 per hour — four syncs.

So today an external repository holds a hard-coded map of this one's
internal layout, and a rename under `packages/` breaks it silently. The
site is currently running with `HOMEPAGE_RELEASE_SOURCE=none` — it shows
nothing at all rather than depending on that bridge.

The contract for the replacement already exists and is not ours to
invent. `app/schemas/manifest.py` in that repository is the reference
definition, and states its own purpose:

> The site reads nothing about the monorepo's internal layout — only this
> document — so packages there can be renamed or split without touching
> the homepage.

What is missing is only the producer: nothing in this repository writes
`releases.json`, and the branch it is expected at does not exist.

## What Changes

- A generator that builds `releases.json` from this repository's own
  facts: each package's `version` from its `package.json`, its newest
  entry from its `CHANGELOG.md`, and the extension's VSIX from the
  GitHub Release the `release-extension` job already creates.
- CI publishes it to the `release-manifest` branch after a release lands
  on `main`, at the URL the site already has configured.
- Tests that hold the parts of the contract this repository can break on
  its own: the five product ids, the schema version, and the shape.

## Capabilities

### Modified Capabilities

- `release-quality`: what this repository ships is published as a
  machine-readable manifest, so a consumer needs no knowledge of the
  monorepo's layout.

## Impact

- A `release-manifest` command in `@openspec-ui/cli` and its tests,
  `.github/workflows/quality.yml`, and a new `release-manifest` branch
  holding one file.
- `@openspec-ui/cli` gains a command, so it takes a minor bump. Nothing
  else published changes, and no product behaviour does.
- `OpenSpec-Ui-Homepage` is **not** modified by this change. Flipping
  `HOMEPAGE_RELEASE_SOURCE` from `none` to `manifest` is that
  repository's own change, and is worth doing only once a manifest is
  actually being published.

## Explicitly out of scope

- **Changing the contract.** `app/schemas/manifest.py` is the reference
  definition and this change conforms to it. If a field is wanted that it
  does not have, that is a change over there first — its rules say a
  producer may add fields the site ignores, but an unknown
  `schema_version` is rejected outright.
- **Choosing the product ids.** They are already in use by the site
  (`vscode-extension`, `standalone-app`, `core`, `shared-ui`, `ci-cli`)
  and are deliberately not the npm package names. Inventing new ones
  would re-announce shipped versions under new identities.
- **Publishing anything not already public.** Two of the five products
  are marked `public: false` in the site's own list; the manifest carries
  them with that flag rather than omitting them, so the site decides what
  to show.
- **Validating against the site's live schema in CI.** That would couple
  this repository's pipeline to a Flask app in another one. The contract
  is asserted here instead, with the site's module named as the
  reference.
