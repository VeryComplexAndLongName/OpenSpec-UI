## Why

Found during a repository review session on 2026-08-24, confirmed by the
existing `npm run lint` output: `readStoredValue` in
`packages/webui/src/standalone-entry.tsx` is unused
(`@typescript-eslint/no-unused-vars`). Its sibling `writeStoredValue` calls
(lines persisting `cwd`/`changeDir` to `localStorage` on every change) are
therefore write-only — nothing ever reads the persisted values back. This
diverges from the equivalent extension bootstrap
(`packages/webui/src/extension-context.ts`'s `resolveInitialDashboardContext`,
consumed by `packages/webui/src/extension-entry.tsx`), which does restore
`cwd`/`changeDir` from storage as a fallback. In the standalone app, when the
`/api/workspace-root` sync fails (the existing `workspaceRootSyncError` state,
rendered at `standalone-entry.tsx`'s "Workspace root sync failed" note), the
`cwd`/`changeDir` inputs stay blank instead of falling back to the
last-known values already sitting in `localStorage`.

## What Changes

- Initialize the `cwd`/`changeDir` state in `StandaloneApp`
  (`packages/webui/src/standalone-entry.tsx`) from
  `readStoredValue(STORAGE_KEYS.cwd)` / `readStoredValue(STORAGE_KEYS.changeDir)`
  instead of `""`, matching the fallback pattern already used by the
  extension bootstrap.
- No change to `writeStoredValue` call sites, `STORAGE_KEYS`, or the
  `/api/workspace-root` sync effect, which still overwrites these fields on a
  successful sync — this only changes what the fields show before that sync
  resolves or if it fails.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; `openspec/specs/standalone-app/spec.md` does not document a
`localStorage` fallback scenario for `cwd`/`changeDir` — this restores
already-intended, already-shipped-but-inert behavior rather than changing a
specified one)

## Impact

- `packages/webui/src/standalone-entry.tsx`
- `packages/webui/package.json` (patch version bump)
