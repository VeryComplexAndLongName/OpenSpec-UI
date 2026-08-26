## 1. Add the template

- [x] 1.1 Add `adopt-changesets` (new category `release-management`),
  mirroring the catalog's existing rigor: manifest with a `defaultBranch`
  variable, proposal/design/tasks artifacts covering
  `.changeset/config.json`, `.changeset/README.md`, the `privatePackages`
  config-field gotcha (filled in as a real Decision/Risk, not a blank
  placeholder), and Non-Goals excluding `npm publish` and
  fixed/linked versioning.
- [x] 1.2 Register it in `packages/core/src/templates/index.ts`.

## 2. Version and changelog

- [x] 2.1 Propose a changeset (`npx changeset`) for `@openspec-ui/core`
  (minor: new template, no breaking change) instead of hand-editing
  `version`/`CHANGELOG.md`; apply it via `npx changeset version`.

## 3. Verification

- [x] 3.1 `npm run typecheck --workspace @openspec-ui/core` passes.
- [x] 3.2 `npm run test --workspace @openspec-ui/core` passes, including
  `template-catalog.test.ts`'s invariant check for the new template.
- [x] 3.3 `npm run lint` (including `lint:english`) passes workspace-wide.
- [x] 3.4 `npm run typecheck` and `npm run test` pass workspace-wide.
- [x] 3.5 Run `openspec change validate --strict add-adopt-changesets-template`.
