---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
---

A change that has landed is archived for you

Once a change's pull request has merged and every item in its task list
is closed, the workspace sweep archives it. It makes one pull request per
pass for every such change, on an `archive-landed-` branch, and asks it to
merge when its checks pass. The Pipeline and Changes then show only what
is still in flight. A change that landed while still owing something is
never archived; the editor warns about it, and the standalone lists it
under "Done for you".

On by default; `"archive": { "whenLanded": false }` in
`openspec/agent-harness.json`, or in one change's `harness.json`, turns it
off. It needs the openspec CLI and a signed-in `gh`. See ADR 0035 and
`HARNESS.md`.
