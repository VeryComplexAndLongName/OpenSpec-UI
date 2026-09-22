---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

GitLab and Gitea, as well as GitHub

A repository on GitLab or Gitea now works where only GitHub did. The
product reads which changes' pull requests are open or merged from
whichever forge `origin` is on, and opens and merges archive pull requests
there. github.com goes through `gh` as before. gitlab.com and self-hosted
GitLab or Gitea go through their REST APIs, with `GITLAB_TOKEN` or
`GITEA_TOKEN` from the environment. For an ssh remote, `GITEA_URL` or
`GITLAB_URL` names the forge. The `git` stage's own pull request still goes
through `gh`.
