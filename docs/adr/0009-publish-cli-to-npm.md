# 0009: Publish `@openspec-ui/cli` to npm as a Bundled Package

Status: Accepted

Date: 2026-08-26

## Context

ADR-0007 added `packages/cli` as a third thin adapter over
`@openspec-ui/core`, scoped to one command (`validate`), and explicitly
deferred publishing it: "Turning it into a globally installable,
published binary is a separate decision for if/when an external consumer
actually needs that." Two things changed since:

1. `2026-08-26-add-gitea-actions-parity` demonstrated the concrete
   friction: reusing the `validate` merge gate on Gitea (or any host
   other than this monorepo's own CI) currently requires cloning this
   entire monorepo and running `npm ci` just to get one command,
   because the CLI is only ever run via `npm run start --workspace
   @openspec-ui/cli -- validate` from inside a full checkout.
2. The user asked, in the same 2026-08-26 review, whether npm
   publishing was worth doing, explicitly leaving the call to this
   agent's own judgment.

An external consumer who wants the merge gate — on GitHub, on Gitea, or
locally — should be able to run `npx @openspec-ui/cli validate` in their
own project without installing this monorepo.

## Decision

1. **Bundle `packages/cli/src/cli.ts` into a single ESM file via
   esbuild** (`packages/cli/scripts/build.mjs`), the same tool
   `packages/extension` and `packages/server` already use for their own
   Node-target bundles. `@openspec-ui/core`'s own source is inlined,
   since core is `"private": true` and not itself published — a
   published `@openspec-ui/cli` must not depend on an unpublished
   workspace package. Core's own dependencies (`cross-spawn`,
   `simple-git`) are kept **external** rather than bundled and declared
   as this package's own real `dependencies` instead: bundling
   `cross-spawn` specifically broke at runtime ("Dynamic require of
   'child_process' is not supported") because esbuild's ESM output
   cannot safely rewrite its internal dynamic `require()` calls, and
   since both are genuinely published npm packages there is no reason to
   duplicate them into the bundle regardless. Concretely,
   `@openspec-ui/core` moves from `dependencies` to `devDependencies` in
   `packages/cli/package.json`: npm workspaces still symlinks it locally
   for `tsc`/`vitest`/the esbuild bundling step, but `devDependencies`
   are not installed for an external `npm install @openspec-ui/cli`
   consumer and are not what such a consumer would resolve against
   anyway, since the bundle already inlines core's own code.
2. **Add a `bin` entry, `openspec-ui-cli`**, matching the self-identifying
   prefix `main.ts` already uses in its own error output
   (`openspec-ui-cli: ...`).
3. **Publish under the existing `@openspec-ui` npm scope, with
   `publishConfig.access: "public"`** (required for a scoped package to
   be publicly installable) and remove `"private": true` from
   `packages/cli/package.json` so Changesets versions it normally
   (independent versioning, not the `privatePackages` path — see
   `2026-08-26-fix-changesets-private-packages-config`).
4. **Scope stays exactly what ADR-0007 already decided: `validate` only.**
   This ADR is about the packaging/distribution mechanism, not about
   expanding the CLI's command surface.
5. **The actual `npm publish` is not performed by this change.** This
   development environment has no npm registry credentials
   (`npm whoami` fails with `ENEEDAUTH`); publishing the first real
   version is a manual step for the user (or a future authenticated CI
   release job, out of scope here), once the bundling and package
   metadata this ADR describes have been reviewed.

## Rejected Alternatives

### Publish unbundled, with `@openspec-ui/core` as a declared `dependency`

Rejected: `@openspec-ui/core` is `"private": true` and not itself
published — npm would fail to resolve it for any consumer outside this
monorepo. Publishing core too just to satisfy this would expand publish
surface and versioning obligations far beyond the one approved use case
(the `validate` merge gate).

### Keep it unbundled and undistributed indefinitely

Rejected per the Context above: the friction this creates for any
non-GitHub-CI, non-monorepo-checkout consumer is now a demonstrated
real cost (the Gitea parity work), not a hypothetical one.

### Wire an automated `npm publish` release job into CI now

Rejected for this change: no registry credentials exist in this
environment to test such a job end-to-end, and a broken or premature
automated-publish step is a worse outcome than a manual first publish.
Automating subsequent releases is a reasonable future change once the
first manual publish has been verified to work as expected.

## Consequences

- `packages/cli/package.json` gains a `build` script, picked up
  automatically by the root `npm run build --workspaces --if-present`
  aggregate (already run in `.github/workflows/quality.yml` and
  `.gitea/workflows/quality.yml`), so the bundle is exercised by CI on
  every push/PR going forward.
- `packages/cli` is no longer `"private": true`; it participates in
  Changesets' normal independent-versioning path, not the
  `privatePackages` workaround.
- This repository's own CI (`quality.yml` / Gitea `quality.yml`)
  continues to use `npm run start --workspace @openspec-ui/cli --
  validate` (the `tsx`-based dev entry point) unchanged — switching this
  repository's own CI to consume the published package is an optional
  follow-up, not required by this change.
