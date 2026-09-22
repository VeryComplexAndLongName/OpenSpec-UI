---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

The product merges its own archive pull requests

A change that has landed is still archived for you in a pull request, but
the product no longer asks GitHub, GitLab or Gitea for an automatic merge.
It follows the pull request itself, every five minutes while it is open,
and merges it once its checks pass, or where the repository has none. It
works the same on every forge, whatever the repository's merge settings.
Where a check fails or the forge refuses the merge, for example because an
approval is required, the pull request stays open and you are told why.
