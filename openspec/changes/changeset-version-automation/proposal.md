## Why

`.changeset/README.md` documents that applying pending changesets
(`npx changeset version` — the step that actually bumps each affected
package's `version` and writes `CHANGELOG.md` entries) is "run separately —
not part of every individual change." Investigation while proposing
`acp-agent-adapters`/`agentic-harness-git-stage` found that this separate
step has no owner or trigger anywhere in this repository: `.github/
workflows/quality.yml` (the only workflow file) has zero mentions of
`changeset`, so there is no automation that ever applies a pending
changeset — only the proposal step (`npx changeset`, already required per
task in every OpenSpec change) is enforced. Nothing prevents `.changeset/`
files from accumulating indefinitely without ever being applied, which is
exactly the class of error changesets was adopted to prevent in the first
place (`.changeset/README.md`'s own stated motivation: "it is easy to
forget... or to forget the bump entirely — both have happened in this
repository's history").

## What Changes

- New CI job (in `.github/workflows/quality.yml`, or a new dedicated
  workflow file) using `changesets/action`: on every push to `main`,
  if one or more `.changeset/*.md` files are present, it opens or updates
  a "Version Packages" pull request that runs `npx changeset version`
  (bumping affected packages' `package.json`/`CHANGELOG.md`) and, once
  that PR is merged, the consumed changesets are gone and the version
  bump is already committed — no `changeset publish` step, matching this
  repository's existing "no npm publishing, ever" posture
  (`.changeset/README.md`).
- No change to the actual release mechanism (`vsce`/`release-extension`
  CI job) — this only automates the step that produces the version bump
  those already rely on, per `.changeset/README.md`'s existing statement
  that changesets "only produces the version bump and changelog entry
  that trigger that existing pipeline; it does not replace it."

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — pure CI/tooling automation, no product-facing behavior change;
`.openspec.yaml` sets `skip_specs: true` accordingly)

## Impact

- `.github/workflows/quality.yml` (or a new workflow file): new
  `changesets/action`-based job.
- No changes to `packages/*` source code.
- No changes to the VS Code extension release mechanism itself.
