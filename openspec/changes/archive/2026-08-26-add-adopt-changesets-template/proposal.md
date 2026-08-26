## Why

Follow-up from the 2026-08-26 discussion on deepening Changesets
integration: rather than baking Changesets-specific UI into the core
product (rejected — Changesets is one release-management tool among many,
and OpenSpec UI stays tool-agnostic per
[docs/adr/0001-shared-core-two-delivery-targets.md](../../../docs/adr/0001-shared-core-two-delivery-targets.md)),
the agreed scope was: a built-in template that lets a project's own
OpenSpec changes propose Changesets adoption for itself, plus a narrow
archive-time reminder (tracked separately). This change adds the
template half. It bakes in the real `privatePackages` gotcha this exact
repository hit and fixed in
`2026-08-26-fix-changesets-private-packages-config`, so a project
adopting Changesets from this template does not have to rediscover it.

## What Changes

- Add `adopt-changesets` (new category `release-management`): manifest
  with a `defaultBranch` variable; proposal/design/tasks artifacts
  covering `.changeset/config.json`, `.changeset/README.md`, the
  `privatePackages` config-field gotcha (documented as a filled-in
  Decision/Risk, not a blank placeholder), and a verification step that
  confirms a real changeset actually changes a version/changelog rather
  than trusting a clean exit code.
- Register it in `packages/core/src/templates/index.ts`.
- Propose a changeset for `@openspec-ui/core` (minor: new template, no
  breaking change) instead of hand-editing `version`/`CHANGELOG.md`.
- No change to `openspec/specs/template-catalog/spec.md`: its existing
  requirements are already generic over the catalog's composition.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none in the specified-behavior sense; `.openspec.yaml` sets
`skip_specs: true`)

## Impact

- `packages/core/src/templates/adopt-changesets.ts` (new)
- `packages/core/src/templates/index.ts`
- `.changeset/*.md` (new changeset file)
