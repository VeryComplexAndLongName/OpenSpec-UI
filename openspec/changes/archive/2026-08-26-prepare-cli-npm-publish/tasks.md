## 1. Bundle the CLI

- [x] 1.1 Add `packages/cli/scripts/build.mjs`: esbuild, ESM output,
  `platform: "node"`, `target: "node22"`, shebang banner,
  `external: ["cross-spawn", "simple-git"]` (bundling them broke at
  runtime — see docs/adr/0009-publish-cli-to-npm.md).
- [x] 1.2 Add a `build` script to `packages/cli/package.json`.

## 2. Package metadata for npm

- [x] 2.1 Remove `"private": true`; add `bin` (`openspec-ui-cli` ->
  `dist/cli.js`), `files: ["dist"]`, `publishConfig.access: "public"`,
  `description`, `license`, `repository`, `keywords`.
- [x] 2.2 Move `@openspec-ui/core` to `devDependencies`; add
  `cross-spawn`/`simple-git` as real `dependencies`, matching core's
  own declared version ranges.
- [x] 2.3 Add `packages/cli/README.md` (usage, exit codes, scope) and
  `packages/cli/LICENSE` (copy of the root MIT license, matching
  `packages/extension/LICENSE`'s existing pattern).

## 3. ADR

- [x] 3.1 Add `docs/adr/0009-publish-cli-to-npm.md`: context, decision,
  rejected alternatives, consequences — including that this change does
  not perform the actual `npm publish` (no registry credentials in this
  environment).

## 4. Verification

- [x] 4.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [x] 4.2 `npm run build --workspace @openspec-ui/cli` produces
  `dist/cli.js`.
- [x] 4.3 Live smoke test: run `node packages/cli/dist/cli.js validate
  --cwd <this repo>` directly (not via `tsx`) and confirm its output is
  identical to the existing `npm run start --workspace @openspec-ui/cli
  -- validate` dev entry point; also run it from outside this
  repository's directory tree to catch any hidden monorepo-relative
  assumption.
- [x] 4.4 `npm pack --dry-run` in `packages/cli` and confirm the tarball
  contains exactly `LICENSE`, `README.md`, `dist/cli.js`,
  `dist/cli.js.map`, `package.json` — no source, no `node_modules`, no
  test files.
- [x] 4.5 `npm pack` for real, `npm install <tarball>` into a scratch
  directory outside this repository, and run the installed
  `node_modules/.bin/openspec-ui-cli` binary against this repository —
  confirms the published `bin` entry and external dependency resolution
  (`cross-spawn`/`simple-git`) actually work for a real external
  consumer. Clean up the scratch directory and local tarball afterward.
- [x] 4.6 `npm run test` passes workspace-wide (no test files changed
  by this packaging-only change, but confirms nothing else broke).
- [x] 4.7 Propose a changeset (`npx changeset`) for `@openspec-ui/cli`
  instead of hand-editing `version`/`CHANGELOG.md`; apply it via `npx
  changeset version`.
- [x] 4.8 Run `openspec change validate --strict prepare-cli-npm-publish`.
