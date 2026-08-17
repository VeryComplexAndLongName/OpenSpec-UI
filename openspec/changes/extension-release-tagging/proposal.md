## Why

`openspec/specs/release-quality/spec.md`'s "The extension delivery
artifact is exercised" requirement currently only promises the packaged
VSIX is "retained... for inspection" — in practice this means a
90-day-expiring GitHub Actions artifact (`actions/upload-artifact`,
`extension-integration` job), with no permanent, versioned, user-facing
place to download a specific release. This is a specific gap raised in
review: this repository has zero git tags, so there is no way to point
at "the commit that shipped `openspec-ui-vscode` 0.9.0" without manually
correlating `package.json` history — and no download link exists once a
CI run's artifact retention window expires. `@vscode/vsce` already names
the packaged file with its version (`openspec-ui-vscode-0.9.0.vsix`,
confirmed by a real local `npm run package` run), so the missing piece is
purely: tag the releasing commit, and publish the artifact somewhere
permanent.

## What Changes

- Add a `release-extension` CI job (`.github/workflows/quality.yml`,
  `needs: [quality, extension-integration]`, `push`-to-`main` only) that,
  when `packages/extension/package.json`'s version has no matching git
  tag yet, creates an annotated tag `openspec-ui-vscode@<version>`,
  pushes it, and publishes a GitHub Release for that tag with the
  versioned `.vsix` attached as a release asset.
- The `.vsix` itself is never committed into `packages/` or anywhere else
  in git — it is a build output, published only as a CI artifact (PRs,
  already existing) and, on release, as a GitHub Release asset. This
  answers the "where should the built artifact live" question raised in
  review: not in source control.
- Idempotent by design: re-running the job (or a second push to `main`
  before the version changes again) is a no-op once the tag for the
  current version already exists.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `release-quality`: "The extension delivery artifact is exercised"
  requirement is extended — the artifact is not just retained
  ephemerally for inspection, it is tagged and published as a permanent,
  versioned GitHub Release on every `main`-branch version bump.

## Impact

- `.github/workflows/quality.yml` (new job).
- No package source changes — `vsce`'s existing default naming
  (`<name>-<version>.vsix`) already satisfies "version visible in the
  artifact's name," confirmed by a real local build; nothing to change
  there.
