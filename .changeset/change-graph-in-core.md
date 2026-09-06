---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

Read the relation between changes from core, and add a blocking one. The
reader for `follows`/`supersedes` moves out of repository scripts and into
`packages/core`, so the editor can use it in any workspace; `blocked_by`
joins them, stating what must land before a change can start. The check
that verifies them is a test rather than a lint script, so it runs with
nothing built, and `openspec-ui-cli change-graph` renders the result.
