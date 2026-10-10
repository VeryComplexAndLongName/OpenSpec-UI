# 0048: npm Is Published by Trusted Publishing, From the Same Dispatch as the Marketplace

Status: Accepted; completes [ADR-0009](0009-publish-cli-to-npm.md) decision 5

Date: 2026-10-10

## Context

ADR-0009 made `@openspec-ui/cli` publishable and left the publish itself
as "a manual step for the user (or a future authenticated CI release job)",
rejecting an automated release job because no registry credentials
existed to test one. The package has since been published by hand, twice.

npm now requires two-factor authentication to publish. A person with a
phone can still publish by hand; a CI job cannot answer a one-time
password. npm offers two ways round that: a granular access token with
two-factor bypass, which is a long-lived secret, or Trusted Publishing,
where the registry trusts one workflow file in one repository and
exchanges that workflow's short-lived OIDC token for a publish
credential. The Marketplace publish
(`the-marketplace-publish-is-a-manual-step`) already settled the shape
of such a step in this repository: asked for, never inferred, confirmed
by a typed word, the credential read by one job.

Two things differ between the channels. The extension is tagged and
released on every version bump, so the Marketplace publishes the
released artifact. The CLI is neither tagged nor released, so npm has no
artifact to take; and Trusted Publishing can only publish from the
workflow run itself.

## Decision

1. **npm is published by Trusted Publishing.** The trusted publisher on
   npmjs.com names `.github/workflows/publish.yml` and the `npm`
   environment. No npm token exists, in a secret or anywhere else, and
   the lint gate fails if a workflow names one.
2. **The Marketplace and npm publishes share one dispatch,
   `publish.yml`.** It takes `vscode_version`, `cli_version` and
   `confirm`. A version left empty skips that channel, so each product is
   published only when named, at its own version. A first job checks the
   confirmation, and both publishing jobs need it, so neither reads a
   credential unconfirmed.
3. **npm publishes what `main` carries, checked against the version
   named.** The job refuses a dispatch from any ref but `main`, refuses a
   version that is not the one `packages/cli/package.json` states on that
   commit, and refuses a version already on the registry. It builds the
   bundle there and publishes it; there is no released artifact to
   download, and inventing a tag and a release for the CLI is not part of
   this decision.
4. **The pinned npm builds; a newer one publishes.** Trusted Publishing
   needs npm 11.5.1 or later. The repository stays on its pinned npm
   (`10.9.0`, the release-quality requirement) for install and build, and
   the npm job installs the exact newer version after both, for the
   publish step alone.

## Rejected Alternatives

### A granular access token with two-factor bypass

Rejected: a long-lived secret that expires and has to be re-issued, and
the one credential in this arrangement that can be copied out of a
run's environment. Trusted Publishing has nothing to copy.

### Two workflows, one per channel, as the Marketplace publish started

Rejected at the owner's choice, in favour of one run: publishing both is one act,
and a second dispatch is a second chance to forget the confirmation or
mistype a version. The cost is one file naming both channels, which the
lint gate keeps honest.

### Raise the pinned npm for the whole repository

Rejected: it would touch every job in three workflow files, the
`packageManager` and `volta` pins and possibly the lockfile, for one
step's benefit. The pin exists so that what CI checks is reproducible.

### Tag and release the CLI, and publish the released artifact

Rejected for now: it is the symmetric design, but it adds a release path
to `quality.yml` for a package nobody downloads from a release page. It
can be added later without changing this decision's guarantees.

## Consequences

- `.github/workflows/publish-marketplace.yml` is replaced by
  `publish.yml`. Anything that dispatched the old file by name uses the
  new one. The npmjs.com trusted publisher must name `publish.yml`;
  renaming the file breaks npm publishing until that setting follows.
- `scripts/check-publish-workflow.mjs` guards both channels.
- ADR-0009 decision 5 is completed: the publish is automated as far as a
  person's dispatch, and no further.
