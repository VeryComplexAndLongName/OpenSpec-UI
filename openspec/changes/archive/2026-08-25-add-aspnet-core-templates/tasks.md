## 1. Add the templates

- [x] 1.1 Add `aspnet-efcore-migrations` (`data-layer`), mirroring
  `python-sqlalchemy-alembic`'s structure: manifest with `dbContextName`
  and `connectionStringEnvVar` variables, proposal/design/tasks artifacts.
- [x] 1.2 Add `aspnet-xunit-testing-baseline` (`testing`), mirroring
  `pytest-coverage-baseline`'s structure: manifest with `projectName` and
  `testProjectName` variables, proposal/design/tasks artifacts.
- [x] 1.3 Add `aspnet-jwt-bearer-auth` (`auth`), mirroring
  `jwt-auth-middleware`'s structure but using ASP.NET Core's built-in
  `AddJwtBearer` + `[Authorize]` idiom: manifest with `jwtSecretEnvVar`
  and `protectedControllerName` variables, proposal/design/tasks
  artifacts.
- [x] 1.4 Register all three in `packages/core/src/templates/index.ts`.

## 2. Version and changelog

- [x] 2.1 Bump `packages/core/package.json` from `0.20.3` to `0.21.0`.
- [x] 2.2 Bump `packages/extension/package.json` from `0.16.3` to
  `0.17.0`, with a matching `packages/extension/CHANGELOG.md` entry.

## 3. Verification

- [x] 3.1 `npm run typecheck --workspace @openspec-ui/core` passes.
- [x] 3.2 `npm run test --workspace @openspec-ui/core` passes, including
  `template-catalog.test.ts`'s invariant check (unique ids, non-empty
  artifacts, every declared variable used in at least one artifact) for
  all three new templates.
- [x] 3.3 `npm run lint` (including `lint:english`) passes workspace-wide.
- [x] 3.4 `npm run typecheck` and `npm run test` pass workspace-wide.
- [x] 3.5 Run `openspec change validate --strict add-aspnet-core-templates`.
