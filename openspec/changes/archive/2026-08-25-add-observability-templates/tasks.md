## 1. Add the templates

- [x] 1.1 Add `structured-request-logging` (`observability`, new
  category), mirroring `node-vitest-testing-baseline`'s Node.js/
  TypeScript-specific structure: manifest with `loggerModulePath` and
  `logLevelEnvVar` variables, proposal/design/tasks artifacts.
- [x] 1.2 Add `request-correlation-id` (`observability`), mirroring
  `flat-to-hexagonal-architecture`'s language-agnostic structure: manifest
  with a `correlationIdHeaderName` variable, proposal/design/tasks
  artifacts.
- [x] 1.3 Register both in `packages/core/src/templates/index.ts`.

## 2. Version and changelog

- [x] 2.1 Bump `packages/core/package.json` from `0.21.0` to `0.22.0`.
- [x] 2.2 Bump `packages/extension/package.json` from `0.17.0` to
  `0.18.0`, with a matching `packages/extension/CHANGELOG.md` entry.

## 3. Verification

- [x] 3.1 `npm run typecheck --workspace @openspec-ui/core` passes.
- [x] 3.2 `npm run test --workspace @openspec-ui/core` passes, including
  `template-catalog.test.ts`'s invariant check for both new templates.
- [x] 3.3 `npm run lint` (including `lint:english`) passes workspace-wide.
- [x] 3.4 `npm run typecheck` and `npm run test` pass workspace-wide.
- [x] 3.5 Run `openspec change validate --strict add-observability-templates`.
