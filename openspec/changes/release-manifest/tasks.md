The contract is not ours. It lives in `OpenSpec-Ui-Homepage`'s
`app/schemas/manifest.py`, and this repository conforms to it. Read that
file before changing anything here; where this list and that file
disagree, that file is right.

One mistake here is silent and expensive: a wrong product id publishes
five new products and re-announces every shipped version under a new
identity. Nothing in CI would go red.

## 1. Generate

- [x] 1.1 `packages/cli/src/release-manifest.ts`, exposed as a
  `release-manifest` command beside `validate`: build the document from
  the repository — `version` out of each `packages/*/package.json`, and
  the newest entry out of each `CHANGELOG.md`. Not a script under
  `.github/scripts/`, as first proposed: nothing there runs in a test
  suite, and section 3 requires these rules to be tested (design.md
  decision 5).
- [x] 1.2 The five products, with the ids the site already uses:
  `vscode-extension` (`packages/extension`), `standalone-app`
  (`packages/server`), `core` (`packages/core`), `shared-ui`
  (`packages/webui`, not public), `ci-cli` (`packages/cli`, not public).
  These are not the npm package names and must not be "corrected" to
  them.
- [x] 1.3 `schema_version: 1`. The site rejects a version it does not
  know and falls back to its last good snapshot, so this number changes
  only after the site has learned the new one.
- [x] 1.4 Map changesets' `### Major/Minor/Patch Changes` headings onto
  `ChangeEntry.kind`, taking only the newest version's entries.
  Reproduce the site's `github_source.py` rules exactly — including
  dropping "Updated dependencies" bullets and their indented package
  lists, stripping the commit-hash prefix, and defaulting to `patch`
  before any section heading. The site is switching from that source to
  this one, and a summary that came out differently would look like an
  edited release note rather than the same release from a new producer.
- [x] 1.5 A changelog that does not parse yields **no** `changes` for
  that product, and does not fail the build. Absent is honest; a guessed
  summary is not.
- [x] 1.6 `artifacts` and `links.release` for `vscode-extension` come
  from the existing `openspec-ui-vscode@<version>` GitHub Release, read
  rather than constructed from a naming convention. The other four carry
  an empty `artifacts` list.
- [x] 1.7 Write nothing for a product whose `package.json` cannot be
  read — fail loudly instead. A missing version is not an absent field,
  it is a broken generator.
- [x] 1.8 Trust a changelog's notes only when its newest version heading
  equals the version in `package.json`. A changelog left behind by a
  failed release would otherwise attach the previous release's notes to
  the current version.

## 2. Publish

- [x] 2.1 `.github/workflows/quality.yml`: publish to the
  `release-manifest` branch as `releases.json`, on push to `main` only.
- [x] 2.2 Publish only when the set of `id@version` pairs differs from
  what the branch already holds. `generated_at` and `commit` move on
  every push and would otherwise add a commit per push that says nothing.
- [x] 2.3 Force-update the branch. Only the current state is ever read;
  history there serves nobody.
- [x] 2.4 Give the job its own `timeout-minutes` and let it gate nothing.
  A publishing failure must not skip the merge gate or the test suite —
  the shape `ci-audit-own-job` established after an npm outage took the
  whole pipeline down.
- [x] 2.5 Run it after `release-extension`, so the extension's release
  exists before the manifest points at it.

## 3. Tests

- [x] 3.1 The five ids, names and `public` flags, pinned against the
  site's own `PackageSpec` list. This is the silent failure; assert it
  explicitly.
- [x] 3.2 `schema_version` is 1 and `products` ids are unique — the two
  things the site validates and rejects the whole document over.
- [x] 3.3 Changelog parsing: each of the three kinds; a version with two
  kinds at once; only the newest version's entries appear.
- [x] 3.4 An unparseable changelog produces a product with no `changes`
  and does not throw. Assert the absence, not merely that it did not
  crash.
- [x] 3.5 A product with no artifact carries an empty list, never a
  fabricated URL.
- [x] 3.6 Run the generator against this repository itself and validate
  the result, so the fixtures cannot drift from the real files.

## 4. Verification

- [x] 4.1 `openspec change validate --strict release-manifest`.
- [ ] 4.2 `npm run typecheck`, `npm run lint`, `npm run test`. Read the
  whole failing-file list.
- [x] 4.3 Generate the manifest locally and validate it against the
  site's own schema — `flask manifest-schema` emits it — rather than
  against this repository's reading of the contract. Record the output.
- [x] 4.4 Changeset for `@openspec-ui/cli` (minor). The first draft of
  this list said no changeset was needed, on the assumption the
  generator would live in `.github/scripts/`. It lives in a published
  package and adds a command to it, so that assumption no longer holds.
- [ ] 4.5 **Human-only**: after the first publish, fetch
  `https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/release-manifest/releases.json`
  and confirm it resolves without credentials.
- [ ] 4.6 **Human-only, and in the other repository**: set
  `HOMEPAGE_RELEASE_SOURCE=manifest` and confirm the site syncs the five
  products and announces nothing that had already shipped. If it
  announces existing versions as new, an id is wrong — see 1.2.
