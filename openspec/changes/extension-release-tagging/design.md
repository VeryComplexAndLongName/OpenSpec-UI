## Context

`.github/workflows/quality.yml` already has a job graph: `quality` (root
verify/build) gates `openspec-validate`, `extension-integration`
(packages the VSIX and runs it through a real Extension Host), and
`browser-e2e`. `extension-integration` already proves the VSIX packages
and passes integration tests before this proposal; the new job reuses
that as a gate rather than re-deriving its own quality bar.

This repository versions each package independently (README.md,
"Versioning" — "no single product version, only package versions are the
source of truth"). A tag scheme must not imply a unified product version
that doesn't exist.

`gh` (GitHub's own CLI) is preinstalled on `ubuntu-latest` GitHub-hosted
runners and authenticates via the job's `GITHUB_TOKEN` automatically —
no new secret, no third-party GitHub Action dependency needed for
"create a release and attach an asset," unlike bringing in something
like `softprops/action-gh-release`.

## Goals / Non-Goals

**Goals:**
- Every `openspec-ui-vscode` version that reaches `main` gets a
  permanent, addressable git tag and a downloadable GitHub Release.
- Safe to run on every push to `main`, not just releases — a no-op when
  the current version is already tagged.

**Non-Goals:**
- No unified cross-package "product version" tag (e.g. bare `v0.9.0`).
  Rejected — see Decisions.
- No release automation for `core`/`server`/`webui` — none of them
  produce a standalone downloadable artifact today (they are consumed
  only as workspace dependencies or bundled into `openspec-ui-vscode`'s
  own VSIX / `server`'s browser bundle); nothing to tag or publish for
  them yet. If that changes, it is an additive follow-up, not a rework of
  this scheme (`<package-name>@<version>` already generalizes).
- No automatic npm-registry or VS Code Marketplace publish. This
  proposal only makes the artifact permanently downloadable via GitHub
  Releases — actually publishing to the Marketplace is a distinct,
  higher-stakes decision (requires a publisher token, is one-way/hard to
  fully undo, and was never asked for) left for a future, explicitly
  scoped change.
- No release-notes curation beyond `gh release create --generate-notes`
  (auto-generated from merged PR titles since the last tag). The
  hand-curated `packages/extension/CHANGELOG.md` (see `changelog-sync`)
  remains the authoritative, readable changelog; the GitHub Release notes
  are a secondary, automatic convenience, not a duplicate maintenance
  burden.

## Decisions

### Tag format: `openspec-ui-vscode@<version>`, not a bare `v<version>`

A bare `v0.9.0` tag implies one unified product version, which
contradicts this repository's own documented versioning model (every
package versions independently; `core` is the real source of truth for
behavior, not an aggregate number). `<package-name>@<version>` (the same
separator convention already familiar from scoped-package release
tooling) stays correct even if another package later gains its own
release artifact and its own tag sequence.

### Trigger: `push` to `main` only, gated on `quality` + `extension-integration`, idempotent by tag-existence check

Rejected `workflow_dispatch` (manual trigger): would require a human to
remember to run it after every version bump, reintroducing exactly the
"a human has to remember a manual step" gap this proposal exists to
close (mirrors the reasoning already used for `ci-cli`'s own CI wiring —
this repository's own consumer should exercise new automation for real,
not leave it as an opt-in nobody triggers). Rejected running on every PR
push: a release must correspond to an actual merged, released state, not
speculative PR commits. The idempotency check (`git rev-parse
<tag>` — succeeds only if the tag already exists) makes "push to main
without a version bump" a safe no-op rather than an error.

### `gh release create --generate-notes`, not a hand-authored release body

Rejected writing a template that duplicates `CHANGELOG.md` content in
CI (e.g. `sed`-extracting the matching version's section): would need to
stay in lockstep with `CHANGELOG.md`'s exact heading format forever, a
new brittle coupling for marginal benefit — `--generate-notes` (merged
PR titles since the last tag) is good enough for a release page whose
primary job is "here's the downloadable file," while `CHANGELOG.md`
remains the actual curated, readable changelog.

### Re-run `npm run package` in the new job instead of sharing the artifact from `extension-integration`

Matches this workflow's existing convention — every job already does its
own fresh `npm ci`/build rather than sharing artifacts between jobs (no
`actions/upload-artifact` + `download-artifact` pairing exists anywhere
in this workflow today). Introducing artifact-passing here only for this
one job would be an inconsistent, one-off pattern for a rebuild that
costs a few seconds.

## Risks / Trade-offs

- **[Risk]** A GitHub Release, once published, is visible to anyone with
  repository read access — unlike the ephemeral, checkout-only CI
  artifact this replaces for archival purposes (the CI artifact upload
  for PR builds is unchanged and still happens). → **Mitigation**:
  accepted; this repository is already public (`"visibility": "public"`,
  confirmed via the GitHub API when this session created earlier PRs),
  so this doesn't newly expose anything that wasn't already reachable
  through the repository itself.
- **[Risk]** If the `release-extension` job runs concurrently with a
  second push to `main` before the first finishes, both could race to
  create the same tag. → **Mitigation**: accepted as low-probability
  (this repository's actual push cadence is one merge at a time via this
  session's own PR-then-merge flow); `git push origin <tag>` fails
  loudly (non-zero exit) on a genuine collision rather than silently
  double-tagging, so the job would fail visibly, not corrupt state.

## Migration Plan

- No data migration; purely additive (new CI job only).
- No package version bump required — no package's own code changes.
- Rollback: remove the new job from `quality.yml`; already-created tags/
  releases are historical record and are not removed by a rollback.
