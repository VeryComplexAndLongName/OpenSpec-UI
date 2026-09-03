---
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Start "Run with Agentic Harness" on the change it was opened for.

The panel opened on `list` with nothing selected, so the user re-entered what they had just said by right-clicking a change. The change now seeds from the `changeDir` the host already sends, and the command kind seeds to `implement` when the panel was opened to run one change — which in turn makes the existing agent pre-selection reachable, since it maps the command kind to a stage and `list` mapped to none.
