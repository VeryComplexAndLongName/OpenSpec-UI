## Why

Specific risk raised in review, hit twice live in the same session: testing
a locally implemented change through "Run with Agentic Harness" requires a
freshly built, freshly installed `.vsix` — the packaged extension is not
hot-reloaded, and (per `openspec/changes/internal-version-cascade/`, merged
in PR #121) the package version only changes when a real changeset is
applied on merge to `main`, never for local, uncommitted work-in-progress.
The manual sequence (`npm run build --workspace packages/extension`, then
`vsce package --no-dependencies`, then locate the versioned `.vsix`
filename, then `code --install-extension <path> --force` because same
-version reinstalls are otherwise a silent no-op, then a manual
"Developer: Reload Window") was performed by hand twice in this session
after two separate stale-bundle failures (the `copilot-prompt-length-limit`
fix appearing not to work, immediately followed by the exact same
confusion for `changeset-version-automation`) — both traced back to
`packages/extension/dist/extension.js` simply being older than the source
fix it was supposed to contain, not any actual behavioral bug.

`internal-version-cascade` already closes the "same version, VS Code
silently skips the reload prompt" gap for real releases. It does not (and,
per its own design.md, was never meant to) address the separate,
already-observed local-iteration failure mode: nothing currently
guarantees that a locally installed `.vsix` reflects the current working
tree at the moment you actually test a change.

## What Changes

- `packages/extension/scripts/reinstall-local.mjs` (new): rebuilds
  (`npm run build`), repackages (`vsce package --no-dependencies`), and
  force-installs (`code --install-extension <the exact just-built .vsix
  path> --force`) in one step, always from whatever is currently on disk
  in the working tree — so the installed extension can never silently lag
  behind local source, regardless of whether the version number changed.
  Prints an explicit final reminder that "Developer: Reload Window" is
  still a separate, manual, un-automatable step (see design.md).
- `packages/extension/package.json`: new `"reinstall:local"` script
  running it.
- `packages/extension/README.md`'s "Development" section: documents the
  new command alongside the existing typecheck/lint/test/build list.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — local developer tooling only, no product-facing behavior;
`.openspec.yaml` sets `skip_specs: true` accordingly)

## Impact

- `packages/extension/scripts/reinstall-local.mjs`, `package.json`,
  `README.md` only.
- No changes to `packages/core`/`server`/`webui`, no changes to the actual
  release mechanism (`release-extension` CI job), and no changeset needed
  (tooling only, matching the precedent already set by
  `openspec/changes/changeset-version-automation/` and
  `openspec/changes/internal-version-cascade/`).
