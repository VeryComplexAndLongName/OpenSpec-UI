---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

GitHub without `gh`, and the git stage on GitLab and Gitea

With `GITHUB_TOKEN` or `GH_TOKEN` in the environment, GitHub is asked over
its API and `gh` is not needed. Without a token, `gh` is used as before.
When neither is there, the product now says so plainly.

The Agentic Harness's `git` stage now works on whichever forge `origin` is
on: it opens the pull request, waits for its checks and merges on GitHub,
GitLab or Gitea alike. It still merges only when a check has actually
passed.
