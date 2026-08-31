## Context

See `proposal.md` for motivation. `.github/workflows/quality.yml` is the
only workflow file in this repository. Its top-level `permissions:
contents: read` is intentionally restrictive; the existing
`release-extension` job already overrides this at job level
(`permissions: contents: write`) and uses the built-in `GH_TOKEN: $
{{ github.token }}` with the `gh` CLI — no stored PAT, no
repository-level permission change — to tag a commit and publish a
release. This is the established, minimal-privilege pattern this change
follows for the new job, rather than introducing a new kind of credential.

## Goals / Non-Goals

**Goals:**

- Whenever one or more `.changeset/*.md` files exist on `main`, a
  "Version Packages" pull request is automatically opened or kept
  up to date, running `npx changeset version` so its diff is the actual
  version bump + `CHANGELOG.md` entries — nothing is applied directly to
  `main` without a PR and review.
- No new secret/credential: reuse the built-in `GITHUB_TOKEN`, matching
  `release-extension`'s existing pattern.
- Zero change to the actual release mechanism
  (`vsce`/`release-extension`) — this only makes sure the version bump
  that mechanism already depends on actually happens.

**Non-Goals (this change):**

- `changeset publish` / npm publishing — every workspace package is
  `"private": true` and this repository never publishes to the npm
  registry; out of scope, per `.changeset/README.md`'s own stated
  policy.
- Auto-merging the "Version Packages" PR — it still needs human review
  and merge, exactly like any other PR in this repository's governance
  model (OpenSpec change validation already gates merges via the
  existing `openspec-validate` job).
- Retroactively applying already-accumulated changesets as part of this
  change's own implementation — that is a one-time manual cleanup
  (`npx changeset version` run once, by a maintainer), not something the
  new CI job needs to do on its first run in a special way.

## Decisions

### `changesets/action` as a new job in the existing `quality.yml`, not a new workflow file

Adding one more job (`version-packages`, triggered only on `push` to
`main`, not on `pull_request`) to the existing workflow file keeps CI
configuration in one place, matching how `release-extension` already
lives alongside `quality`/`openspec-validate` in the same file.

**Rejected alternative**: a separate workflow file dedicated to
versioning. Rejected — no other job in this repository is split out this
way (`release-extension`, `openspec-validate`, and `quality` all share
`quality.yml`); a new file would be an inconsistent, unmotivated
departure from that pattern for no functional benefit.

### Reuse the built-in `GITHUB_TOKEN`, not a new PAT/secret

`changesets/action` needs `contents: write` (to push the version-bump
commit to its own PR branch) and `pull-requests: write` (to open/update
that PR) — both grantable via a job-level `permissions:` override on the
built-in token, exactly like `release-extension` already does for
`contents: write`.

**Rejected alternative**: a personal access token (PAT) stored as a
repository secret, which some `changesets/action` setups use to allow the
resulting PR to itself trigger CI (the built-in `GITHUB_TOKEN` does not
re-trigger workflows on the PR it creates, by GitHub's own design, to
prevent infinite loops). Rejected — introducing a stored credential
purely to work around that limitation is a disproportionate cost for this
repository's scale; the "Version Packages" PR's contents (a version bump
+ changelog diff) do not need code-quality CI to re-run on them the same
way a feature PR does, and a maintainer can always re-run/push an empty
commit manually if verification is wanted before merging it.

## Risks / Trade-offs

- **[Risk]** The "Version Packages" PR, created with `GITHUB_TOKEN`, will
  not automatically re-trigger `quality`/`openspec-validate` on itself
  (GitHub's built-in-token limitation, not a bug in this setup).
  → **Mitigation**: its diff is mechanically generated (version bump +
  changelog only, from already-reviewed changesets), so it does not need
  the same fresh CI verification a feature PR does; noted explicitly in
  this design rather than silently accepted.
- **[Trade-off]** Changesets still accumulate between merges to `main`
  until the "Version Packages" PR is itself merged — this change does not
  force immediate versioning on every single push, only keeps the
  pending-PR reliably up to date so nothing is silently forgotten.

## Migration Plan

No data migration. First run after this change ships will likely open one
"Version Packages" PR bundling whatever changesets have already
accumulated in `.changeset/` (including the ones this session's
`acp-agent-adapters`/`agentic-harness-git-stage` will eventually add) —
reviewing and merging that PR once is the one manual step needed to bring
package versions back in sync; no separate migration task required beyond
that ordinary review.
