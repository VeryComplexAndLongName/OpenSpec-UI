## Why

Third step of a user-requested, ordered sequence of built-in-template
additions raised during a repository review session on 2026-08-25 (after
`add-aspnet-core-templates` and `add-observability-templates`):
`framework-migration` currently has exactly one template
(`flask-to-fastapi`, Python backend), while `template-catalog-v2/
proposal.md` names "JavaScript" as its own target language, distinct from
"Node.js" (already covered by four other templates, all backend/tooling
-- none frontend). A Create React App to Vite migration is a very common,
concrete instance of a JavaScript frontend migration.

## What Changes

- Add `cra-to-vite` (`framework-migration`): replaces `react-scripts` with
  Vite (build config, HTML entry point, `REACT_APP_*` -> `VITE_*`
  environment variables), mirroring `flask-to-fastapi`'s structure and
  rigor in the same category.
- Register it in `packages/core/src/templates/index.ts`.
- Bump `packages/core` (`0.22.0` -> `0.23.0`, minor) and
  `packages/extension` (`0.18.0` -> `0.19.0`, minor), with a matching
  `packages/extension/CHANGELOG.md` entry, same reasoning as the two
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

- `packages/core/src/templates/cra-to-vite.ts` (new)
- `packages/core/src/templates/index.ts`
- `packages/core/package.json`
- `packages/extension/package.json`
- `packages/extension/CHANGELOG.md`
