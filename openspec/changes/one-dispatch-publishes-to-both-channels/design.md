## Context

Two published products, versioned independently by changesets:
`openspec-ui-vscode` (tagged and released on every bump, so the
Marketplace publish can take the released VSIX) and `@openspec-ui/cli`
(neither tagged nor released). Trusted Publishing on npm trusts a
repository's workflow file and, as far as the registry documents it, the
top-level workflow of a run rather than a reusable workflow it calls. The
full reasoning is in ADR-0048; this document is the shape of the
workflow.

## Goals / Non-Goals

**Goals**

- One dispatch that can publish to either channel or both, each at the
  version it names.
- No npm token, anywhere.
- The guarantees of the Marketplace publish unchanged: dispatch only,
  typed confirmation before any credential is read, the released artifact.
- The lint gate holds for both channels.

**Non-Goals**

- Tagging or releasing the CLI. npm publishes from `main` against a named
  version instead.
- Raising the repository's pinned npm for install and build.
- Changing `quality.yml`, either copy.
- Publishing the private workspace packages.
- Dispatching the workflow. The first real publish is the owner's.

## Decisions

### One file, `publish.yml`, three jobs

`confirm` checks the word and that a version was named; `marketplace` and
`npm` each need it and are skipped when their version is empty. They do
not need each other: a failure in one does not cancel the other, and
neither can be taken back, so the run summary of each says what went out.

Rejected: two workflow files, as before, which doubles the confirmation
and the version typing; and reusable workflows called from a thin
dispatcher, because Trusted Publishing is bound to the file that is
registered and a reusable workflow is the case the registry is least
clear about.

Renaming `publish-marketplace.yml` to `publish.yml` and registering the
new name on npmjs.com is preferred to putting the Marketplace job in a
file called `publish-npm.yml`.

### npm builds and publishes from `main`, for the version named

There is no released CLI artifact to download. The job therefore checks
out the dispatch's commit, refuses any ref but `main`, refuses a version
that `packages/cli/package.json` does not state there, and refuses one
already on the registry (`npm view`), then builds the bundle and
publishes. Trusted Publishing signs provenance for what was built in this
run, which is the claim a registry consumer can check.

Rejected: tagging and releasing the CLI first. It is the symmetric
design, and it can be added later without changing these guarantees; it
costs a release path in `quality.yml` for a package nobody downloads from
a release page.

### The pinned npm builds, a newer one publishes

`npm@10.9.0` installs and builds, as everywhere else. After the build the
job installs `npm@11.5.1`, the first release that supports Trusted
Publishing, for the publish step alone. Its engines accept the pinned
Node.js 22.11.0.

Rejected: raising the pin repository-wide, which touches every job and the
lockfile for one step.

### The lint gate reads the new file

`check-publish-workflow.mjs` reads `publish.yml` and fails where: a
trigger other than `workflow_dispatch` appears; a confirmation, either
version input or the `needs: confirm` of a publishing job is missing; the
Marketplace publish loses `--packagePath` or rebuilds; the npm job is not
in the `npm` environment, lacks `id-token: write`, does not refuse a
non-`main` ref or does not check the version against the commit and the
registry; `id-token: write` is granted twice; an npm token is named; or
another workflow names a token or publishes to either channel.

## Risks / Trade-offs

- **The workflow file name is a contract with npmjs.com.** Renaming
  `publish.yml` breaks the npm publish until the trusted publisher
  follows. The workflow's own comment and ADR-0048 say so.
- **npm is built from `main`, not from a tag.** Between a version being
  merged and a dispatch, `main` can move on; the version check fails then,
  rather than publishing a different tree under the same number.
- **A failed npm publish after a successful Marketplace one** leaves the
  channels at different versions. Each is independent by design, and a
  re-dispatch with only the failed channel's version names the remainder.
- **Not exercised before merge.** A workflow that publishes cannot be run
  in a pull request. The lint check and its tests cover the file's shape;
  the first dispatch is the owner's and is recorded in the tasks.
