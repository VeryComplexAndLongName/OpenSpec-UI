---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Add the Agentic Harness (assisted level): a two-level (global +
per-change), product-owned config that recommends a CLI agent per
OpenSpec-change stage in the Agent Selection picker, and shows which
agent ran a process plus its percent-complete in the Processes view.
Configurable via a new "Harness Settings" GUI in both delivery targets.

See `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` and
`openspec/changes/agentic-harness/` for the full design. Only the
`assisted` autonomy level is functional in this release —
`semi-autonomous`/`autonomous`/the `git` stepAgent action/parallel task
execution are accepted in the config schema for forward compatibility
but not yet implemented, and are visibly marked as such in the Harness
Settings UI.
