## Why

Raised directly by the user during a repository review session on
2026-08-25, following up on a template-catalog suggestion request:
`template-catalog-v2/proposal.md` (archived) originally named four target
languages for the built-in template catalog — "Python, JavaScript,
ASP.NET Core, and Node.js" — but ASP.NET Core has had zero built-in
templates since the catalog's inception, while Python and Node.js each
have four. This is a real gap against the catalog's own stated scope, not
a speculative "nice to have."

## What Changes

- Add three built-in templates under `packages/core/src/templates/`,
  mirroring the existing Python/Node.js templates in the same categories:
  - `aspnet-efcore-migrations` (`data-layer`) — EF Core `DbContext` +
    Migrations scaffolding, mirroring `python-sqlalchemy-alembic` /
    `prisma-orm-migrations`.
  - `aspnet-xunit-testing-baseline` (`testing`) — xUnit + `coverlet`
    coverage baseline, mirroring `node-vitest-testing-baseline` /
    `pytest-coverage-baseline`.
  - `aspnet-jwt-bearer-auth` (`auth`) — ASP.NET Core's built-in
    `AddJwtBearer` middleware + `[Authorize]` attributes. Deliberately a
    separate template from the existing `jwt-auth-middleware`, not a
    variant of it: ASP.NET Core's idiomatic shape (framework-provided
    middleware, declarative attributes) differs enough from a
    hand-written middleware function that folding it into the existing
    template would misrepresent the idiomatic approach.
- Register all three in `packages/core/src/templates/index.ts`.
- Bump `packages/core` (`0.20.3` -> `0.21.0`, minor: new capability
  content, no breaking change) and `packages/extension`
  (`0.16.3` -> `0.17.0`, same reasoning as the already-archived
  `bump-extension-for-english-agent-instructions`: `packages/extension`
  bundles `packages/core`'s source directly via esbuild, so these new
  templates ship in the extension's Templates tree too) with a matching
  `packages/extension/CHANGELOG.md` entry.
- No change to `openspec/specs/template-catalog/spec.md`: its existing
  requirements ("a fixed set of built-in templates... included regardless
  of scan") are already generic over the catalog's composition and do not
  enumerate specific templates, so no new scenario is needed.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none in the specified-behavior sense -- see "No change to
openspec/specs/template-catalog/spec.md" above; `.openspec.yaml` sets
`skip_specs: true` accordingly)

## Impact

- `packages/core/src/templates/aspnet-efcore-migrations.ts` (new)
- `packages/core/src/templates/aspnet-xunit-testing-baseline.ts` (new)
- `packages/core/src/templates/aspnet-jwt-bearer-auth.ts` (new)
- `packages/core/src/templates/index.ts`
- `packages/core/package.json`
- `packages/extension/package.json`
- `packages/extension/CHANGELOG.md`
