---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
---

A change's branch that falls behind is rebased for you

The working-directory sweep now rebases a change's branch that has fallen
behind the default branch and pushes it with `--force-with-lease`, so its
pull request's checks run again against the current default branch. Two
pull requests that were green apart meet on the same `main` before either
lands.

It happens only where nothing can be lost: the branch is named after a
change, was pushed and is still on the server, equals its upstream, has a
clean tree and no run working in it. A conflict is never resolved - the
rebase is aborted, the branch is left as it was, and the files are named;
the editor raises a warning. A push the lease refuses puts the branch back.

It is on by default. `branches.rebaseWhenBehind: false` in
`openspec/agent-harness.json`, or in one change's `harness.json`, turns it
off - for a team that shares change branches, say. See ADR 0034 and
`HARNESS.md`.

The standalone now runs the same sweep as the editor, removal of finished
working directories included, and says what it did under "Done for you".
