## Why

Second step of a user-requested, ordered sequence of built-in-template
additions raised during a repository review session on 2026-08-25 (after
`add-aspnet-core-templates`): "observability" — structured request
logging and request correlation — was identified as a real gap in the
catalog's category coverage (`data-layer`, `framework-migration`,
`architecture-migration`, `testing`, `ci-cd`, `auth`,
`containerization` existed; no category covered logging/tracing), and a
very common early-stage proposal shape in real projects.

## What Changes

- Add two built-in templates, opening a new `observability` category:
  - `structured-request-logging` — Node.js/TypeScript-specific (matching
    this catalog's existing pattern of ecosystem-specific tooling
    templates over vague cross-language ones where the concrete library
    choice matters): replaces ad-hoc `console.log`/`console.error` with a
    structured JSON logger and one request-logging middleware.
  - `request-correlation-id` — language-agnostic (matching
    `flat-to-hexagonal-architecture`'s convention): generates or
    propagates a per-request correlation ID, threads it through that
    request's logs, and echoes it back on the response. Independent of
    `structured-request-logging` — neither requires the other, though
    they compose naturally.
- Register both in `packages/core/src/templates/index.ts`.
- Bump `packages/core` (`0.21.0` -> `0.22.0`, minor) and
  `packages/extension` (`0.17.0` -> `0.18.0`, minor), with a matching
  `packages/extension/CHANGELOG.md` entry, same reasoning as
  `add-aspnet-core-templates`.
- No change to `openspec/specs/template-catalog/spec.md`: its existing
  requirements are already generic over the catalog's composition and do
  not enumerate specific templates or categories.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none in the specified-behavior sense; `.openspec.yaml` sets
`skip_specs: true`)

## Impact

- `packages/core/src/templates/structured-request-logging.ts` (new)
- `packages/core/src/templates/request-correlation-id.ts` (new)
- `packages/core/src/templates/index.ts`
- `packages/core/package.json`
- `packages/extension/package.json`
- `packages/extension/CHANGELOG.md`
