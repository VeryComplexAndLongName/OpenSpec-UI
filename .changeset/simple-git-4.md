---
"@openspec-ui/core": patch
"@openspec-ui/cli": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

simple-git 4.0.2, which fixes two critical advisories in earlier versions (GHSA-v5rq-49vh-5v5c, GHSA-x6jw-m9v5-85vh) (simple-git-4). simple-git 4 removes `GIT_` and other guarded variables from the environment of the git it starts; the product now opens git through one function that lets through only what a person set up to reach a remote - `GIT_ASKPASS`, `SSH_ASKPASS`, `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `GIT_TERMINAL_PROMPT` - so pushes keep authenticating, and keeps every other guarded variable away from git.
