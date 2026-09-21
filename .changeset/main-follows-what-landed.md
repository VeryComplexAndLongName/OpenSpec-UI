---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

Your main checkout follows what landed

The workspace sweep now fast-forwards the main checkout's `main` to
`origin/main`, so a change that landed, or an archive, shows up or leaves
without anybody pulling. It does this only when the tree is clean, `main`
has no commits of its own, and no run is working in it; otherwise it says
how far behind `main` is and why. It pushes nothing, and
`"branches": { "followMain": false }` turns it off.

The editor sweeps again 15 minutes after opening an archive pull request,
so the archive arrives soon after it merges. The Pipeline's drift line now
names the changes on `origin/main` that this checkout does not show. An
archive pull request's title names the changes it archives.
