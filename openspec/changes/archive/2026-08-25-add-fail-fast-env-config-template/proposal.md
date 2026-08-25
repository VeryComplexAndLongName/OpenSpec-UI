## Why

Fourth and final step of a user-requested, ordered sequence of built-in-
template additions raised during a repository review session on
2026-08-25 (after `add-aspnet-core-templates`, `add-observability-
templates`, and `add-cra-to-vite-template`): fail-fast environment
configuration -- validating required environment variables once at
startup instead of discovering a missing one later, at whatever code path
first reads it -- is a narrow, high-value, very common early-stage
proposal, and no existing category covered configuration validation.

## What Changes

- Add `fail-fast-env-config` (`configuration`, new category):
  Node.js/TypeScript-specific, a schema-validated config module parsed
  once from `process.env` at startup, throwing one error listing every
  missing/invalid variable if validation fails -- before the server binds
  a port -- mirroring `production-dockerfile`'s and
  `jwt-auth-middleware`'s pattern of introducing a new category with one
  focused template.
- Register it in `packages/core/src/templates/index.ts`.
- Bump `packages/core` (`0.23.0` -> `0.24.0`, minor) and
  `packages/extension` (`0.19.0` -> `0.20.0`, minor), with a matching
  `packages/extension/CHANGELOG.md` entry, same reasoning as the three
  prior template-addition changes in this sequence.
- No change to `openspec/specs/template-catalog/spec.md`: its existing
  requirements are already generic over the catalog's composition.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none in the specified-behavior sense; `.openspec.yaml` sets
`skip_specs: true`)

## Impact

- `packages/core/src/templates/fail-fast-env-config.ts` (new)
- `packages/core/src/templates/index.ts`
- `packages/core/package.json`
- `packages/extension/package.json`
- `packages/extension/CHANGELOG.md`
