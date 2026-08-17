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

## Idempotency, confirmed for real

A second push to `main` landed shortly after (this very documentation
follow-up, which didn't touch `packages/extension`), giving a real
second run without a version bump. Fetched that run's actual job log
(not just the green check) and confirmed the exact expected line:

```
Tag openspec-ui-vscode@0.9.0 already exists — nothing to release.
```

The job exited immediately after that line — no second tag, no second
release, no VSIX rebuild. Task 1.2's idempotency requirement is verified
end to end, not just by design.
