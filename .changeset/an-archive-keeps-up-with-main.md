---
"@openspec-ui/core": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

An archive pull request is brought up to date when the forge asks for it

Some repositories only merge pull requests that are up to date with the
default branch, such as GitHub's "require branches to be up to date",
GitLab's fast-forward merge, and Gitea's outdated-branch block. There, an
archive pull request the sweep opened could never merge once something
else landed first. Now, when the forge refuses it and the default branch
has moved on, the sweep rebuilds the archive on the current default
branch, updates its own branch, and merges it once the checks pass again.
