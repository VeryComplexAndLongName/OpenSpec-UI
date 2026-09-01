---
"@openspec-ui/core": patch
---

An Agentic Harness chain now decides between the `apply` and `archive` stages from the change's own `tasks.md` checkboxes, and refuses to archive while any task is unchecked. Previously `statusChange()` synthesized a `progress` value from artifact presence when the CLI reported none, where an artifact being "done" means only that its file exists; a change with all four artifact files written and every task unchecked therefore reported `remaining: 0`, and a chain skipped `apply` and archived it unimplemented. `progress` is now optional on `OpenSpecStatusResult` and absent when the CLI reports none, rather than fabricated. When task completion cannot be determined at all, a chain starts at `apply` and refuses to archive, so an unknown signal never selects the irreversible stage.
