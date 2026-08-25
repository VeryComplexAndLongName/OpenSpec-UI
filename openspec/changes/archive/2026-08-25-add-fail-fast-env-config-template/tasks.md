## 1. Add the template

- [x] 1.1 Add `fail-fast-env-config` (`configuration`, new category):
  manifest with a `configModulePath` variable, proposal/design/tasks
  artifacts covering schema definition, import-time validation, and
  startup wiring, with secrets-manager integration and full codebase
  migration explicitly out of scope (Non-Goals).
- [x] 1.2 Register it in `packages/core/src/templates/index.ts`.

## 2. Version and changelog

- [x] 2.1 Bump `packages/core/package.json` from `0.23.0` to `0.24.0`.
- [x] 2.2 Bump `packages/extension/package.json` from `0.19.0` to
  `0.20.0`, with a matching `packages/extension/CHANGELOG.md` entry.

## 3. Verification

- [x] 3.1 `npm run typecheck --workspace @openspec-ui/core` passes.
- [x] 3.2 `npm run test --workspace @openspec-ui/core` passes, including
  `template-catalog.test.ts`'s invariant check for the new template.
- [x] 3.3 `npm run lint` (including `lint:english`) passes workspace-wide.
- [x] 3.4 `npm run typecheck` and `npm run test` pass workspace-wide.
- [x] 3.5 Run `openspec change validate --strict add-fail-fast-env-config-template`.
