## 1. Fix

- [x] 1.1 `.changeset/config.json`: add
  `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.
  updateInternalDependents: "always"`. `updateInternalDependencies` itself
  stays `"patch"` — it only accepts `"patch"`/`"minor"` (confirmed against
  the installed `@changesets/config@3.0.1` schema; an initial attempt to
  set `"always"` there failed `npx changeset status` outright with an
  "Invalid type" config error). See design.md for why this key, not
  `fixed`/`linked`.

## 2. Verification

- [x] 2.1 `openspec change validate --strict internal-version-cascade` —
  passes.
- [x] 2.2 Dry-run confirmation: created a throwaway changeset file
  targeting only `@openspec-ui/core`, ran `npx changeset status --verbose`
  before and after the config edit. Before: only `@openspec-ui/core`
  listed. After: `@openspec-ui/core`, `@openspec-ui/server`,
  `@openspec-ui/webui`, and `openspec-ui-vscode` all listed for a patch
  bump. Removed the throwaway changeset file immediately after (`npx
  changeset status --verbose` confirmed a clean "Packages to be bumped:"
  with nothing listed); it was never committed.
- [x] 2.3 No changeset needed for this change itself (tooling/config only,
  no `packages/*` source change) — matches the precedent already set by
  `openspec/changes/changeset-version-automation/`.
