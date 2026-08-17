Verified for real after merging [PR #31](https://github.com/VeryComplexAndLongName/OpenSpec-UI/pull/31)
— the `release-extension` job only fires on `push` to `main`, so it
correctly showed as `skipped` on the PR itself and only actually ran on
the merge commit (`95538aa`).

## Real outcome on the merge commit

`release-extension` completed successfully. Confirmed directly via the
GitHub API (not just the green check mark):

- **Tag**: `openspec-ui-vscode@0.9.0` — `refs/tags/openspec-ui-vscode@0.9.0`
  exists, pointing at an annotated tag object.
- **Release**: <https://github.com/VeryComplexAndLongName/OpenSpec-UI/releases/tag/openspec-ui-vscode%400.9.0>,
  titled "openspec-ui-vscode 0.9.0", published by `github-actions[bot]`.
- **Asset**: `openspec-ui-vscode-0.9.0.vsix`, 1,761,754 bytes, download
  URL <https://github.com/VeryComplexAndLongName/OpenSpec-UI/releases/download/openspec-ui-vscode%400.9.0/openspec-ui-vscode-0.9.0.vsix> —
  the exact same filename `vsce` already produces locally (confirmed
  earlier in this same session's design work).
- **Auto-generated notes** (`--generate-notes`) correctly listed every
  merged PR in the repository's history (since this is the first tag
  ever created here) — this repository has never had a tag before this
  change, so the "since the last tag" range fell back to the full
  history, exactly as `gh`'s documented behavior for a first release.

No other-CI-job task remained to re-verify (idempotency on a second,
version-unchanged push to `main`) — that will naturally get exercised
the next time any package other than `openspec-ui-vscode` merges to
`main` without an extension version bump, and the job's design (a plain
`git rev-parse -q --verify` tag-existence check before doing anything
else) makes that a low-risk, cheap thing to leave to happen naturally
rather than manufacturing a second empty commit just to force it.
