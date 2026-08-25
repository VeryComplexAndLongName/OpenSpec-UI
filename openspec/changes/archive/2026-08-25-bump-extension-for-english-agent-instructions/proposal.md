## Why

The user asked directly on 2026-08-25 whether it was normal for
`packages/extension`'s version to still read `0.16.2` after today's
`retranslate-legacy-comments-to-english` change (already merged) and the
already-applied `bump-core-version-for-prompt-text-change`. It is not:
`packages/extension` depends on `@openspec-ui/core` as a workspace link
(`"@openspec-ui/core": "*"` in `packages/extension/package.json`), and
esbuild bundles `packages/core`'s source directly into the extension's
`dist/extension.js` at build time -- there is no separately-versioned,
installed `@openspec-ui/core` package to pin. `commandInstruction()`'s
English-instead-of-Russian output for `plan`/`implement`/`review`/`status`/
`cancel` (the change that justified `core`'s own `0.20.2` -> `0.20.3` bump)
therefore ships in any VSIX built from `main` today, and per
`operations.apply.guidance` in `openspec/config.yaml` ("A version bump in
the affected package's package.json is mandatory in sync with every
externally visible behavior change"), `packages/extension`'s version and
`CHANGELOG.md` should have moved too -- this repository's own precedent
(`CHANGELOG.md`'s `0.15.1` entry) bumps even for docs-only changes.

## What Changes

- Bump `packages/extension/package.json` from `0.16.2` to `0.16.3` (patch:
  a behavior change in existing output text, not a new capability or a
  breaking one).
- Add a `0.16.3` entry to `packages/extension/CHANGELOG.md` describing the
  English-instead-of-Russian agent instruction text.
- No code change; this only reconciles the version/changelog with behavior
  that already shipped in `2026-08-25-retranslate-legacy-comments-to-english`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this change does not itself modify behavior -- it corrects a
version number and changelog entry that should have moved with a behavior
change already shipped in a prior archived change)

## Impact

- `packages/extension/package.json`
- `packages/extension/CHANGELOG.md`
