## Why

ADR-0007 shipped `@openspec-ui/cli` unbundled, run only via `npm run
start --workspace @openspec-ui/cli -- validate` from inside a full
checkout of this monorepo, and explicitly deferred publishing until an
external consumer needed it. `2026-08-26-add-gitea-actions-parity`
demonstrated the concrete cost of that deferral: reusing the `validate`
merge gate anywhere other than this repository's own CI requires cloning
this entire monorepo. The user separately asked whether npm publishing
was worth doing, leaving the call to this agent's judgment. See
`docs/adr/0009-publish-cli-to-npm.md` for the full decision and rejected
alternatives.

## What Changes

- Add `packages/cli/scripts/build.mjs`: bundles `src/cli.ts` into a
  single ESM file via esbuild (mirroring `packages/extension`'s existing
  Node-target bundling), with `@openspec-ui/core`'s own source inlined
  but its real, published dependencies (`cross-spawn`, `simple-git`)
  left external — bundling `cross-spawn` broke at runtime ("Dynamic
  require of 'child_process' is not supported"); see the ADR.
- Update `packages/cli/package.json`: remove `"private": true`; add
  `bin` (`openspec-ui-cli`), `files`, `publishConfig.access: "public"`,
  `description`/`license`/`repository`/`keywords`; move
  `@openspec-ui/core` to `devDependencies` (workspace-link/build-time
  only) and add `cross-spawn`/`simple-git` as real `dependencies`
  (matching core's own declared ranges); add a `build` script (picked up
  automatically by the root `npm run build --workspaces --if-present`
  aggregate already run in CI on both hosts).
- Add `packages/cli/README.md` and `packages/cli/LICENSE` (an npm
  package's own directory, not the repo root, is what a registry page
  and `npm pack` read from).
- Add `docs/adr/0009-publish-cli-to-npm.md`.
- Propose a changeset for `@openspec-ui/cli` (patch: `0.1.0` ->
  `0.1.1`), consistent with this project's changeset-per-package-change
  convention, now that the package is no longer `"private": true` and
  participates in Changesets' normal independent-versioning path.
- **Does not perform an actual `npm publish`.** This environment has no
  npm registry credentials (confirmed: `npm whoami` fails with
  `ENEEDAUTH`). The bundling was verified instead via `npm run build`,
  running the bundled `dist/cli.js` directly (output byte-identical to
  the `tsx`-based dev entry point), and a full `npm pack` +
  `npm install <tarball>` + run-the-installed-`bin` round trip in a
  scratch directory outside this repository — the closest verification
  possible without a real publish.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none in the specified-behavior sense — this changes packaging/
distribution, not `validate`'s behavior; `.openspec.yaml` sets
`skip_specs: true`)

## Impact

- `packages/cli/scripts/build.mjs` (new)
- `packages/cli/package.json`
- `packages/cli/README.md` (new)
- `packages/cli/LICENSE` (new)
- `docs/adr/0009-publish-cli-to-npm.md` (new)
- `.changeset/*.md` (new changeset file)
