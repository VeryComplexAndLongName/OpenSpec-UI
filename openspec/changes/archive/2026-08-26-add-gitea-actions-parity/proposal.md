## Why

Follow-up from the 2026-08-26 discussion ("Предлагаю ... сделать CLI
одинаковым для Github и Gitea") and the agreed Gitea Actions plan. A
proof-of-concept was validated end-to-end on the user's own Gitea
instance (Gitea 1.26.4, self-hosted `ubuntu-latest` runner): a scratch
repository confirmed `actions/checkout@v4` (a GitHub Marketplace action)
runs unmodified, and a "require changeset when package source changed"
check correctly failed without a changeset and passed once one was
added. This change carries that validated approach into the actual
repository as reference/portable CI, so a fork or mirror hosted on
Gitea gets the same `@openspec-ui/cli validate` merge gate and the same
Changesets discipline as the GitHub-hosted original, without touching
`.github/workflows/` at all (Gitea ignores `.github/`, GitHub ignores
`.gitea/` — the two are additive, not conflicting).

## What Changes

- Add `.gitea/workflows/quality.yml`: mirrors the `quality` (typecheck,
  lint, test, build, `npm audit`) and `openspec-validate` (the
  `@openspec-ui/cli validate` merge gate — the concrete "same CLI on
  both hosts" requirement) jobs from `.github/workflows/quality.yml`,
  using `${{ github.workspace }}` (a context expression, confirmed
  working during the POC) instead of the `$GITHUB_WORKSPACE` env var
  (not independently verified on Gitea Actions).
- Add `.gitea/workflows/require-changeset.yml`: the POC's
  require-a-changeset check, adapted to this repository's real
  structure — gates on `packages/*/src/**` or `packages/*/package.json`
  changes (not any file under `packages/`, which would over-trigger on
  docs-only edits) lacking an accompanying `.changeset/*.md` file.
- Deliberately out of scope (not mirrored): `extension-integration`,
  `release-extension` (uses `gh release`, GitHub-token-specific), and
  `dependency-review` (`actions/dependency-review-action` is a
  GitHub-only API integration, not Marketplace-portable) — these need
  host-specific redesign, not a mechanical mirror, and are not part of
  the validated POC scope.
- Not adding an equivalent changeset-presence check to
  `.github/workflows/`: that would newly gate every existing GitHub PR
  on this repository, a policy change distinct from Gitea-portability
  and better made as its own explicit decision later if wanted.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none in the specified-behavior sense; `.openspec.yaml` sets
`skip_specs: true` — these are additional execution surfaces for the
same already-specified `quality-gates`/`ci-cli` behavior, not new or
changed product behavior)

## Impact

- `.gitea/workflows/quality.yml` (new)
- `.gitea/workflows/require-changeset.yml` (new)
