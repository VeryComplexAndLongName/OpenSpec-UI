## Why

Specific risk raised in review, reproduced live: PR #120 bumped
`@openspec-ui/core` `0.33.0` -> `0.33.1` (the `copilot-prompt-length-limit`
fix). `packages/extension/package.json`'s version stayed `0.30.0` — correct
per `.changeset/config.json`'s `"updateInternalDependencies": "patch"`,
which only cascades a bump to a dependent when the dependent's declared
SemVer range on the bumped package would otherwise become unsatisfied.
`packages/extension/package.json` declares `"@openspec-ui/core": "*"` (also
`"*"` for `@openspec-ui/webui`/`@openspec-ui/server`), a range that is
always satisfied, so it never cascades — confirmed this is by design, not a
bug, in the prior session that shipped PR #120.

The live consequence: the user manually reinstalled the locally packaged
`.vsix`, and VS Code did not prompt for a window reload. VS Code's update
detection compares the extension's manifest version string; since it was
unchanged, VS Code did not recognize the reinstall as an update, even
though the packaged JS is different (`@openspec-ui/core` is bundled into
the extension at build time, per `docs/adr/0001-shared-core-two-delivery-
targets.md`'s architecture — `extension` is a thin transport adapter around
`core`, but it still ships `core`'s compiled code inside its own `.vsix`).
Without an explicit manual "Developer: Reload Window", the user would be
silently testing stale in-memory code while believing they had the fix.

This is exactly the class of error `.changeset/README.md` states changesets
exists to prevent ("it is easy to forget... or to forget the bump
entirely"): here nothing was forgotten procedurally, but the configured
policy (`"patch"`) treats a private, unpublished monorepo's SemVer ranges
as if they were a real external compatibility contract, when in this
repository they are not (`openspec/changes/changeset-version-automation/
design.md` independently confirms every workspace package is
`"private": true` and never published to the npm registry). Also checked
`openspec/changes/changeset-version-automation/` (a separate, in-progress,
not-yet-committed change by another agent): it only automates *running*
`npx changeset version` in CI; it does not touch `updateInternalDependencies`
or any dependency range, so it does not overlap with or address this.

## What Changes

- `.changeset/config.json`: add
  `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.updateInternalDependents:
  "always"`. `updateInternalDependencies` itself only accepts `"patch"`/
  `"minor"` (confirmed against the installed `@changesets/config@3.0.1`
  schema — an `"always"` value there fails config validation outright);
  the actual "cascade regardless of whether the declared range would still
  resolve" lever lives under this separate, explicitly experimental key,
  read directly from `@changesets/assemble-release-plan`'s
  `determineDependents()` source. `updateInternalDependencies` itself stays
  `"patch"` (unused once the experimental flag is set, since the flag makes
  the range-satisfaction check irrelevant for every dependent). This makes
  a changeset on any internal workspace package (e.g. `@openspec-ui/core`)
  always produce at least a patch bump (with its own changelog entry) on
  every workspace package that depends on it (`server`, `webui`,
  `extension`), regardless of whether the dependent's declared range
  (`"*"`) would technically still resolve — reflecting that the
  dependent's bundled/shipped code actually changed, which is the signal
  that actually matters for a versioned, user-installed artifact like the
  extension's `.vsix`. Verified live: a throwaway changeset targeting only
  `@openspec-ui/core` (`npx changeset status --verbose`) now lists
  `@openspec-ui/server`, `@openspec-ui/webui`, and `openspec-ui-vscode` as
  bumped too, where before this change it listed only `@openspec-ui/core`;
  the throwaway changeset file was removed after verifying, not committed.
- No change to any package's declared dependency range (`"*"` stays as is)
  — see design.md for why widening ranges instead was rejected.
- No source code change in `packages/*`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — pure tooling/versioning-policy change, no product-facing behavior;
`.openspec.yaml` sets `skip_specs: true` accordingly)

## Impact

- `.changeset/config.json` only.
- Every future changeset that touches `@openspec-ui/core`, `@openspec-ui/
  webui`, or `@openspec-ui/server` will also bump and changelog every
  workspace package that depends on it, once the next `npx changeset
  version` run applies pending changesets under the new policy.
- No changes to `packages/*` source code, and no changeset needed for this
  change itself (tooling/config only, matching the precedent already set by
  `openspec/changes/changeset-version-automation/`).
