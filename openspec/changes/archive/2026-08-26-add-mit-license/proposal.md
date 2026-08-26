## Why

Second step of a user-requested, ordered sequence raised during a
repository review session on 2026-08-25/26 (after `adopt-changesets`):
every `package.json` in this repository declares `"license": "MIT"`, and
`packages/extension/LICENSE` already exists (bundled into the VSIX by
`vsce`), but there was no `LICENSE` file at the repository root. For a
public GitHub repository, an SPDX license identifier in `package.json`
without the corresponding license text in the repository is ambiguous —
GitHub itself only recognizes a repo as licensed when it can detect a
`LICENSE`/`LICENSE.md`/etc. file, not from `package.json` content alone.

## What Changes

- Add `LICENSE` at the repository root: standard MIT license text,
  copyright holder "Alexander Ivanov", year 2026 — identical wording to
  the already-existing `packages/extension/LICENSE`, confirming that
  file's holder/year were already the intended values, not a stale
  placeholder.
- No change to any `package.json`'s `"license": "MIT"` field (already
  correct) or to `packages/extension/LICENSE` (already correct).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a legal/documentation-only addition, not a specified
behavior)

## Impact

- `LICENSE` (new)
