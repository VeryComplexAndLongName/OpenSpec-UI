---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": minor
---

A team's people are in the repository

Each person on a team now has a file in the repository,
`openspec/people/<handle>.json`, holding their name and a public key for
each machine they work on. Every colleague and every machine can then
verify what a person, or an agent working for them, signs, with no
server. Join with **OpenSpec Workbench: Join the Team** in the editor, or
`openspec-ui-cli join --handle <handle> --name <text>`, then commit the
file in a pull request. The merge gate keeps these files sound: a key is
retired, never removed, so what it signed keeps verifying. This is the
first step of team work (ADR 0037).
