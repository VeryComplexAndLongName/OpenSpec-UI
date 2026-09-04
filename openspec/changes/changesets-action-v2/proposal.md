## Why

`changesets/action@v1` runs the `version-packages` job, which opens and
maintains the "Version Packages" pull request. v2 has been out since
2026-08-11 and v1 will not keep receiving fixes.

Dependabot proposed the bump as PR #207, and it was closed: the job is
gated to `main`, so no pull request can exercise it, and merging a major
on a green pull request that never ran the changed job is how a release
pipeline stops silently. `dependabot-block-action-majors` now prevents
that arriving unreviewed. This change is the review.

## What was actually checked

Against this repository's configuration, not the release notes' generic
warnings. The current step is the whole of it:

```yaml
      - name: Create or update version PR
        uses: changesets/action@v1
        env:
          GH_TOKEN: ${{ github.token }}
```

| v2 breaking change | Effect here |
| --- | --- |
| `GITHUB_TOKEN` env support removed; token must come from the `github-token` input | **None.** `github-token` exists in v1 too, with the same `default: ${{ github.token }}` — so the input has always supplied the token and `env: GH_TOKEN` was never load-bearing. It is dead configuration in both versions. |
| Inputs renamed (`version`→`version-script`, `publish`→`publish-script`, `commit`→`commit-message`, `title`→`pr-title`, `branch`→`pr-base-branch`) | **None.** No inputs are passed. |
| `cwd` removed | **None.** Not used. (It is in fact still present in v2's `action.yml`.) |
| `push-git-tags` now defaults to `true` | **None.** Its own description scopes it to "after publish", and no `publish-script` is configured, so the publish path never runs. Tags for the VS Code extension are created by this workflow's own `release-extension` job, untouched. |
| Changesets v1 compatibility removed; v2 uses Changesets v3 | **None.** `@changesets/cli` is already `^3.0.1`. |
| Release commits and tags pushed via the GitHub API by default | **This is the real change.** The version branch is pushed through the API rather than the git CLI. The job already grants `contents: write`. Commit attribution moves to the token's owner and commits become GPG-signed by GitHub. |

So the migration is one version string plus removing a line that does
nothing — and one behavioural change worth stating rather than
discovering.

## What cannot be checked

**The job does not run on pull requests.** `version-packages` carries
`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, so
this change's own pull request will show it as `skipping`. Its checks
passing is not evidence about it.

The first real execution is the next push to `main` that carries pending
changesets. This is stated in the change rather than left for whoever
reads a green pull request to assume otherwise.

## What Changes

- `.github/workflows/quality.yml`: `changesets/action@v1` → `@v2`.
- The same step's `env: GH_TOKEN` block is removed as dead, and
  `github-token` passed explicitly as an input instead — the same value,
  in the place the action actually reads it from, so the next reader does
  not have to re-derive that the env block did nothing.

## Capabilities

### Modified Capabilities

- `release-quality`: the version pull request is maintained by the
  current major of the action, with its token supplied where the action
  reads it.

## Impact

- `.github/workflows/quality.yml` only.
- Nothing published changes; no changeset.

## Explicitly out of scope

- **Configuring publishing.** This repository does not publish to npm
  from CI, and `publish-script` stays unset. Adding it would change what
  the release pipeline does, which is not this change.
- **`push-with-git-cli: true`.** Keeping the old push mode would preserve
  today's commit attribution, but the API push is v2's default and the
  supported path; opting out to avoid a cosmetic difference would mean
  carrying a deviation with no benefit.
- **Pinning the action to a commit SHA.** A supply-chain question,
  unrelated to which major runs.
