---
"@openspec-ui/core": minor
---

A harness configuration file (`openspec/agent-harness.json` or a per-change
`harness.json`) carrying a top-level key that is not `stepAgents`,
`autonomyLevel`, `reviewGate`, `checkpoints`, `budget`, or
`gitStageAllowlist` is now refused, naming the unrecognized key and the
accepted set. Previously such a file resolved silently to the default
configuration wherever the misplaced key's effect would have applied —
found via a per-change `harness.json` whose `apply` sat at the top level
instead of inside `stepAgents`, which loaded without error or warning and
was never once applied. When the unrecognized key is a stage name
(`propose`, `review`, `apply`, `verify`, `archive`, `git`), the error names
`stepAgents.<key>` as a possible fix.
