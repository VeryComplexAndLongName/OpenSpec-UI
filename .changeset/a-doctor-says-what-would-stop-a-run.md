---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

`openspec-ui-cli doctor` reports what this machine and this workspace are
missing before a run is started, instead of leaving it to be discovered
by being refused: the runtime against the pinned engines, the `openspec`
CLI, which agents are installed, whether the harness configuration reads,
who holds the workspace, and whether a git identity is configured.
`--change <id>` adds the preflight's own answer for one change. Exit `0`
nothing would stop a run, `1` something would, `2` it could not look.
