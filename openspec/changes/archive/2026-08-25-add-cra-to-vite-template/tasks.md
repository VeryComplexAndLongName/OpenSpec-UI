## 1. Add the template

- [x] 1.1 Add `cra-to-vite` (`framework-migration`), mirroring
  `flask-to-fastapi`'s structure: manifest with `sourceDir` and
  `envVarPrefix` variables, proposal/design/tasks artifacts covering
  build-tool replacement, the HTML entry point, and environment-variable
  renaming, with CRACO/custom-webpack migration and test-runner migration
  explicitly out of scope (Non-Goals).
- [x] 1.2 Register it in `packages/core/src/templates/index.ts`.

## 2. Version and changelog

- [x] 2.1 Bump `packages/core/package.json` from `0.22.0` to `0.23.0`.
- [x] 2.2 Bump `packages/extension/package.json` from `0.18.0` to
  `0.19.0`, with a matching `packages/extension/CHANGELOG.md` entry.

## 3. Verification

- [x] 3.1 `npm run typecheck --workspace @openspec-ui/core` passes.
- [x] 3.2 `npm run test --workspace @openspec-ui/core` passes, including
  `template-catalog.test.ts`'s invariant check for the new template.
- [x] 3.3 `npm run lint` (including `lint:english`) passes workspace-wide.
- [x] 3.4 `npm run typecheck` and `npm run test` pass workspace-wide.
- [x] 3.5 Run `openspec change validate --strict add-cra-to-vite-template`.
