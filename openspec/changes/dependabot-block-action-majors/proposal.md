## Why

`.github/dependabot.yml` blocks every major bump in the npm ecosystem,
with a comment listing what taught it that: typescript 6→7, eslint 9→10,
`@eslint/js` 9→10, vitest 2→4, `@types/vscode` 1.90→1.134 — each one an
unreviewed grouped PR that broke the pinned toolchain.

The `github-actions` ecosystem has no ignore rules at all. So
`changesets/action` 1→2 arrived as PR #207: a major bump of the action
that runs the release pipeline.

An action major is worse than an npm major here, not better, because CI
cannot see it coming. The `version-packages` job carries
`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, so
on a pull request it is skipped — #207 shows it as `skipping`, along with
every other Dependabot PR. **A fully green pull request proves nothing
about the job the change actually alters.** The first real execution
would be after merge, on `main`, and a failure would present as release
pull requests quietly no longer being created.

The same holds for the other release-path actions this workflow uses. An
action that only runs on `main`, or only on a tag, cannot be exercised by
the pull request that changes it.

This is not a judgement about `changesets/action` v2 in particular —
reviewing it found its `github-token` input defaults identically in both
versions and that none of the renamed inputs are used here. It is about
which bumps are allowed to land without anyone looking.

## What Changes

- `.github/dependabot.yml`: the `github-actions` ecosystem gains the same
  blanket major-bump ignore the npm ecosystem already has, with a comment
  saying why an action major is specifically unverifiable on a pull
  request here.
- Minor and patch action bumps, including security fixes, keep flowing
  automatically. Only majors wait for a deliberate change.

## Capabilities

### Modified Capabilities

- `release-quality`: automatic dependency updates exclude major bumps in
  both ecosystems, not only npm.

## Impact

- `.github/dependabot.yml` only.
- PR #207 is closed rather than merged; the `changesets/action` v2 move
  is taken as its own reviewed change.

## Explicitly out of scope

- **Bumping `changesets/action` to v2.** That is a separate change, so
  that a problem with the migration can be reverted without also
  reverting this policy, and so that reviewing it is not bundled with
  agreeing to the policy.
- **Blocking minor or patch action bumps.** The failures on record are
  all majors, and stopping the rest would stop security fixes with them.
- **Pinning actions to commit SHAs.** A stronger supply-chain posture,
  and a different question from whether an unreviewed major can land.
