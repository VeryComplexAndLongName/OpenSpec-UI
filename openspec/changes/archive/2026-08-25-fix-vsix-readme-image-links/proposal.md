## Why

The user installed a locally built `v0.20.1` VSIX and reported on
2026-08-25 that every screenshot in VS Code's Extensions view -> OpenSpec
Workbench -> Details tab was broken. Reproduced by building the VSIX
(`npm run package --workspace openspec-ui-vscode`) and extracting the
bundled `extension/readme.md`: `vsce package` auto-rewrites relative
image paths to `https://github.com/<repo>/raw/HEAD/<original-path>`, but
does not account for this package's `repository.directory`
(`packages/extension`) and does not collapse `..` path segments. The
previous relative paths
(`../../docs/images/extension/overview-expanded.png`, etc., correct when
GitHub renders `packages/extension/README.md` in place) became
`https://github.com/VeryComplexAndLongName/OpenSpec-UI/raw/HEAD/../../docs/images/extension/overview-expanded.png`
in the bundled README -- a literal, unresolvable URL. Verified the fix by
rebuilding the VSIX and confirming `vsce` leaves already-absolute URLs
untouched, and that the target `raw.githubusercontent.com` URL returns
HTTP 200.

## What Changes

- Replace all 9 relative image paths in `packages/extension/README.md`
  with absolute `https://raw.githubusercontent.com/
  VeryComplexAndLongName/OpenSpec-UI/main/docs/images/extension/*.png`
  URLs. Absolute URLs render correctly in every context this README is
  read in: GitHub's web UI, the VS Code Marketplace page, and a locally
  packaged/sideloaded VSIX's Details tab -- while relative paths only
  ever worked for the first of those three.
- Bump `packages/extension` (`0.20.1` -> `0.20.2`, patch: a real
  user-facing bugfix) with a matching `CHANGELOG.md` entry.
- No change to root `README.md` or `packages/server/README.md`: neither
  is ever packaged into a VSIX, so their relative image paths (correct
  for GitHub rendering, the only context they're read in) are unaffected
  by this bug.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a documentation-only bugfix)

## Impact

- `packages/extension/README.md`
- `packages/extension/package.json`
- `packages/extension/CHANGELOG.md`
