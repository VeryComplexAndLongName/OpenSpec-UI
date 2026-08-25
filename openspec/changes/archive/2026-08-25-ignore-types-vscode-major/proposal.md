## Why

The user reported on 2026-08-25 that PR #67 ("Bump the npm-development
group across 1 directory with 2 updates": `@types/vscode`, `happy-dom`)
failed CI in the "Extension integration and package" job. The user pasted
the actual CI log for the `package` step, which pinpointed the exact cause:

```
Error: @types/vscode ^1.134.0 greater than engines.vscode ^1.90.0.
Either upgrade engines.vscode or use an older @types/vscode version
```

`vsce package` refuses to build when `@types/vscode`'s declared range
exceeds `packages/extension/package.json`'s `engines.vscode` field. PR #67
bumped `@types/vscode` from `^1.90.0` to `^1.134.0` alone, without also
raising `engines.vscode` — the same declared-minimum-VS-Code-version the
extension promises to support. Reproduced locally by checking out the PR
branch and running `npm run package --workspace openspec-ui-vscode`, which
fails with the identical error.

(An earlier local investigation session chased a different, unrelated
failure in `npm run test:integration` — reproducible on `main` itself with
three different pinned VS Code versions, pointing to a local Windows-only
environment issue rather than anything caused by this PR. That thread was a
dead end; the real, CI-confirmed cause is the `vsce package` check above.)

## What Changes

- Add an `ignore` entry for `@types/vscode` (versions `>=1.91.0`) to the
  `npm` update block in `.github/dependabot.yml`, alongside the existing
  `typescript`, `eslint`, `@eslint/js`, and `vitest` entries.
- Unlike the other four entries, this one isn't a permanent toolchain pin:
  `@types/vscode` and `engines.vscode` must move together, deliberately, as
  a joint decision about which VS Code versions this extension supports —
  raising `engines.vscode` is a real product/support-policy call (it raises
  the minimum VS Code version users need), not a mechanical fix, so it's
  left for a separate, deliberate change rather than done here.
- No change to the grouping, schedule, or the `github-actions` update block.
- Does not itself resolve PR #67 (Dependabot manages that PR's lifecycle,
  same as it auto-superseded PR #62 and PR #65 once their matching ignore
  rules merged).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; CI/tooling configuration change, not a specified behavior)

## Impact

- `.github/dependabot.yml`
