## Context

See `proposal.md` for the live incident that surfaced this. Every workspace
package (`packages/core`, `packages/server`, `packages/webui`,
`packages/extension`) is `"private": true` and never published to the npm
registry (`openspec/changes/changeset-version-automation/design.md`
confirms this independently, for a different, unrelated change). The
package version numbers exist purely for: (1) `CHANGELOG.md` entries, (2)
the VS Code Marketplace version of `packages/extension` — the one place a
version string is externally visible to a real user, and (3) any future
"build info" surface in the UI (`config.yaml`'s own versioning rule already
anticipates this: "show `core` separately if the UI exposes build
information"). None of these three uses depends on strict SemVer
compatibility between internal workspace packages — there is no external
consumer resolving `"@openspec-ui/core": "*"` against a published registry
entry.

## Goals / Non-Goals

**Goals:**

- Whenever a changeset targets an internal workspace package, every other
  workspace package that depends on it also gets a version bump and
  changelog entry the next time `npx changeset version` runs — so a
  dependent's version string reliably signals "the code I ship changed",
  which is what VS Code's own update-detection (and any human skimming
  `CHANGELOG.md`) actually needs.
- Minimal, single-point-of-truth fix: one config flag, not a per-package
  convention every future change has to remember to follow by hand.

**Non-Goals (this change):**

- Retroactively bumping `packages/extension` to reflect the `0.33.0 ->
  0.33.1` core change from PR #120 — that gap already shipped under the old
  (`"patch"`) policy and is a one-time, already-understood historical fact,
  not something this change needs to correct after the fact. The next real
  changeset on any internal package will already cascade under the new
  policy; no synthetic changeset is needed just to force an immediate bump.
- Automating *when* `npx changeset version` runs — that is exactly
  `openspec/changes/changeset-version-automation/`'s scope, a separate,
  already-in-progress change; this change only affects *what* that command
  bumps once it runs, not what triggers it.
- Changing any package's declared dependency range away from `"*"` — see
  Decisions below.

## Decisions

### `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.updateInternalDependents: "always"` (repo-wide), not per-package range edits

Chosen, after checking the actual behavior against the installed
`@changesets/config@3.0.1`/`@changesets/assemble-release-plan` source
rather than assuming from the option's name alone (an assumption that was
initially wrong — see below): the top-level `updateInternalDependencies`
key only ever accepts `"patch"`/`"minor"` (its zod schema in
`@changesets/config`'s `dist/index.mjs` is a plain
`union([literal("minor"), literal("patch")])`; setting `"always"` there
fails config validation with `npx changeset status`). The actual "bump a
dependent regardless of whether its declared range would still resolve"
behavior lives in a separate, explicitly experimental/unstable key —
`___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.updateInternalDependents`
— read directly from `determineDependents()` in
`@changesets/assemble-release-plan`'s source: the range-satisfaction check
that normally gates a cascade is skipped outright when this flag is
`"always"`. Verified live (see proposal.md) that setting it makes a
core-only changeset also list `server`/`webui`/`openspec-ui-vscode` in
`npx changeset status --verbose`. This is a single setting that
automatically covers `server`, `webui`, and `extension` alike — including
any future workspace package — without needing to be re-applied by hand
each time a new internal dependency edge is added.

**Rejected alternative**: widen each dependent's declared range (e.g.
`packages/extension/package.json`'s `"@openspec-ui/core": "*"` ->
`"^0.33.1"`, pinned/bumped by hand alongside every core release) so that
plain `"patch"` cascades naturally once the range is "outgrown". Rejected —
this reintroduces exactly the class of error changesets exists to prevent:
a human (or agent) would have to remember to keep every internal range
manually in sync with the current version on every release, in every
dependent's `package.json`, forever. It also provides no benefit — version
ranges are not enforced against anything external here; `"*"` costs
nothing today and a hand-maintained range would be pure process risk for
zero real compatibility guarantee.

**Rejected alternative**: a `fixed` group (`packages/core` + `extension` +
`server` + `webui` all forced to the exact same version number on every
release). Checked `matchFixedConstraint()`'s actual source: a `fixed` group
does cascade (it adds every group member to the release set, not only
ones already releasing), but it also forces every member's `oldVersion` to
the group's current highest version, i.e. it permanently converges all
four packages onto one shared version number going forward. Rejected —
that is a much bigger behavior change than intended (this repo
deliberately tracks `core`'s and the extension's version numbers as
separate histories today — `config.yaml`'s own versioning rule says to
"show `core` separately if the UI exposes build information", which
presumes they can differ) for no benefit over the experimental flag, which
gets the cascade without forcing lockstep version numbers.

**Rejected alternative**: a `linked` group. Checked `applyLinks()`'s actual
source: `linked` does *not* cascade a release to a package that isn't
already independently releasing — it only synchronizes the bump level and
base version among packages that are *already* in the same release batch
for other reasons. It would not have made a core-only changeset touch
`extension` at all, so it does not solve this problem; noted here only
because it is easy to reach for from the option's name without checking
its actual semantics, which is exactly the mistake an earlier draft of
this design made about `updateInternalDependencies: "always"` itself.

## Risks / Trade-offs

- **[Trade-off]** Every future changeset on `@openspec-ui/core` (a package
  changed frequently, since it holds all business logic) will now also
  bump `server`/`webui`/`extension` on every single release, even for
  changes those three packages are functionally unaffected by in any
  externally observable way (e.g. an internal core refactor with no
  behavior change still gets a changeset per this repo's own versioning
  rule in `config.yaml`, and would now cascade). Accepted — a slightly
  noisier changelog on unpublished, private packages is a much smaller
  cost than a user silently running stale code after what looks like an
  update, which is the failure mode this change closes.
- **[Risk]** None identified around CI/release mechanics: this only changes
  what `npx changeset version` computes, not when it runs
  (`changeset-version-automation`'s concern) or how `release-extension`
  packages/publishes the `.vsix` (unaffected — it already just reads
  whatever version is in `packages/extension/package.json` at release
  time).
- **[Risk]** The chosen key's own name says
  `WILL_CHANGE_IN_PATCH` — its shape is not part of `changesets`' stable
  public API and could change (or be removed) in a future `@changesets/
  cli`/`config` release without a major version bump. → **Mitigation**: if
  a future dependency update silently drops or renames it, `changesets`'
  own config schema validation fails loudly on any `npx changeset status`/
  `version` run (an unknown/invalid key under a strict zod schema, the same
  way `"always"` on `updateInternalDependencies` failed loudly during this
  change's own verification) rather than silently reverting to the old
  per-range cascade behavior — so a break here is caught immediately by
  the very next changeset-touching CI run or local command, not discovered
  later as a repeat of the original incident.

## Migration Plan

No data migration. The very next `npx changeset version` run (whenever the
next changeset targeting any internal package is applied) will start
cascading under the new policy; nothing needs to run immediately as part of
this change itself.
