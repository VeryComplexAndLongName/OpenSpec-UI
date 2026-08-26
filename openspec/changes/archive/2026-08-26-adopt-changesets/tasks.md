## 1. Install and configure

- [x] 1.1 Add `@changesets/cli` as a root dev dependency.
- [x] 1.2 Add `.changeset/config.json`: independent versioning,
  `commit: false`, `ignore: ["openspec-ui"]`.
- [x] 1.3 Add `"private": true` to `packages/extension/package.json`
  (discovered via `changeset status`'s tree-consistency check; verified
  it doesn't affect `vsce package`).
- [x] 1.4 Add `changeset`/`changeset:version` scripts to the root
  `package.json`.

## 2. Document the workflow

- [x] 2.1 Add `.changeset/README.md`: what a changeset is, this
  repository's specific workflow, and what Changesets is explicitly not
  used for here (no npm publish; `vsce`/`release-extension` unchanged).
- [x] 2.2 Update root `README.md`'s "Versioning" section to reference
  the new workflow and correct its stale package-version table.
- [x] 2.3 Update `openspec/config.yaml`'s `operations.apply.guidance` to
  require a changeset instead of a hand-edited `version` field.

## 3. Verification

- [x] 3.1 `npx changeset status` runs cleanly (no config-validation
  errors, `Packages to be bumped: []` since no changeset is pending).
- [x] 3.2 Rebuild the VSIX (`npm run package --workspace
  openspec-ui-vscode`) and confirm it packages identically after adding
  `"private": true`.
- [x] 3.3 `npm run typecheck` passes workspace-wide.
- [x] 3.4 `npm run lint` (including `lint:english`) passes workspace-wide.
- [x] 3.5 `npm run test` passes workspace-wide.
- [x] 3.6 Run `openspec change validate --strict adopt-changesets`.
