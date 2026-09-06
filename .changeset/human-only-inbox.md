---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
---

Add a Human-Only Inbox view listing every open item marked as requiring a
person, across all active changes — reachable from the change it belongs to,
with no control to mark one done, since the rule those items live by is that
a person reports them done after observing the thing. `readTaskChecklist`
now marks a task `humanOnly` when its first bold span begins with
"Human-only".

Also adds two quality-gate checks in `@openspec-ui/core`, run as tests: one
fails when a change's tasks say "Successor created: `id`" but no change
states it follows that change, and one fails when a change's `## MODIFIED
Requirements` block no longer matches the specification it modifies — a
renamed requirement header or an omitted scenario — catching drift at
pull-request time instead of at `openspec archive`.
