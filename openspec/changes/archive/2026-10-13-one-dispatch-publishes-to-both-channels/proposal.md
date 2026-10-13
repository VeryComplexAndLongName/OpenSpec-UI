## Why

`@openspec-ui/cli` is meant for npm (ADR-0009), and its publish was left
as a manual step on the grounds that no registry credential existed to
test an automated one. It has since been published by hand, twice. npm now
requires two-factor authentication, which a person can answer and a CI job
cannot, and the owner wants the publish to run from the pipeline, asked
for in the way the Marketplace publish already is
(`the-marketplace-publish-is-a-manual-step`).

The Marketplace publish is a workflow of its own with one version input.
Adding npm as a second workflow would mean two dispatches, two
confirmations and two version fields for what the owner treats as one act:
releasing. The two products are versioned independently, so one run has to
name two versions and be able to skip either.

ADR-0048 records the decisions this change implements.

## What Changes

- **One dispatch, two channels.** `.github/workflows/publish.yml` replaces
  `publish-marketplace.yml`. It takes `vscode_version`, `cli_version` and
  `confirm`; an empty version skips its channel; a first job checks the
  confirmation and both publishing jobs need it.
- **npm is published by Trusted Publishing.** The `npm` job holds
  `id-token: write`, is bound to the `npm` environment and uses no token.
  The trusted publisher on npmjs.com names `publish.yml` and that
  environment.
- **npm publishes what `main` carries, for the version named.** The job
  refuses a dispatch from any other ref, a version that is not the one
  `packages/cli/package.json` states, and a version already on the
  registry. The pinned npm builds; an exact newer npm (11.5.1) is
  installed for the publish step alone.
- **The lint gate guards both channels.** `check-publish-workflow.mjs`
  also fails on an npm token anywhere, a second workflow publishing to
  npm, and a publishing job that does not wait for the confirmation.
- **The documents say what happens.** `README.md` and `.changeset/
  README.md` stop saying that nothing is published to npm.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-quality`: the repository can publish `@openspec-ui/cli` to npm,
  from the same dispatch as the Marketplace publish, and only when a
  person names the version.

## Impact

- **`.github/workflows/publish.yml`**: new; `publish-marketplace.yml` is
  removed. Anything that dispatched the old file by name uses the new one.
- **`.github/workflows/quality.yml`** and **`.gitea/workflows/quality.yml`**:
  untouched.
- **`scripts/check-publish-workflow.mjs`** and its test: now read
  `publish.yml` and check the npm job.
- **`README.md`, `.changeset/README.md`**: corrected.
- **`docs/adr/0048-...md`**, **`docs/adr/README.md`**, **ADR-0009's
  status**: new decision recorded.
- **npmjs.com** (outside the repository): the trusted publisher for
  `@openspec-ui/cli` must name `publish.yml` and the `npm` environment.
- No package's behaviour changes, so no changeset.
